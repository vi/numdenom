type Content = IContent
type NumOrStr = string | number;

interface IContent {
  filters: IFilter[];
  values: IValueColumn[];
  filters_data: string[][];
  values_data: number[][];
  main_denom: number | null;
}

interface IFilter {
  name: string;
  vals: string[];
}

interface IValueColumn {
    name: string;
    num: number;
    denom: number;
  }

interface Window {
    compressed_data: string;
    content: Content;
    total_values: number[];
}

const darkMode = window?.matchMedia?.('(prefers-color-scheme:dark)')?.matches ?? false;

const decompress = async (url) => {
    // @ts-ignore
    const ds = new DecompressionStream('gzip');
    const response = await fetch(url);
    const blob_in = await response.blob();
    const stream_in = blob_in.stream().pipeThrough(ds);
    const blob_out = await new Response(stream_in).blob();
    return await blob_out.text();
};

function init() {
    let cdata : string = window.compressed_data
    decompress(cdata).then((result) => {
        window.content = JSON.parse(result)
        build_settings_pane()
        build_main_table();
    });
}


interface IRowInfo {
    values: number[];

    promoted_filters: string[];
}
type RowInfo = IRowInfo

let high_contrast_colorisations : Set<string> = new Set()
let relative_N : boolean = false

function handle_highcontrast_checkbox(name: string) {
    if (high_contrast_colorisations.has(name)) {
        high_contrast_colorisations.delete(name)
    } else {
        high_contrast_colorisations.add(name)
    }
    build_main_table()
}
function chart_settings_visibility_checkbox() {
    let chk = document.getElementById("chart_toggle") as HTMLInputElement
    let sets = document.getElementById("chart_settings") as HTMLDivElement

    if (chk.checked) {
        sets.setAttribute("style","")
    } else {
        sets.setAttribute("style","display:none")
    }
}
function show_description_checkbox() {
    let show_desc_ck = document.getElementById("show_description") as HTMLInputElement
    let description = document.getElementById("description") as HTMLParagraphElement

    if (show_desc_ck.checked) {
        description.setAttribute("style","")
    } else {
        description.setAttribute("style","display:none")
    }
}

function build_main_table() {
    let url_fragment = []
    let colheads = document.getElementById("column_headers") as HTMLTableRowElement;

    colheads.replaceChildren()

    let nvalues = window.content.values.length
    let values_rowlength = window.content.values_data[0].length

    let value_nums = []
    let value_denoms = []

    let filter_policies = []

    let filtered_values = new Array(values_rowlength).fill(0)
    let highcontrast = []

    let min_denom = (document.getElementById("min_denom") as HTMLInputElement).valueAsNumber
    let ch_col =    (document.getElementById("ch_col") as HTMLInputElement).value
    let ch_fn =     (document.getElementById("ch_fn") as HTMLInputElement).value
    let ch_width =  (document.getElementById("ch_width") as HTMLInputElement).valueAsNumber
    let ch_min_setting =    (document.getElementById("ch_min") as HTMLInputElement).valueAsNumber
    let ch_max_setting =    (document.getElementById("ch_max") as HTMLInputElement).valueAsNumber
    let ch_line =  (document.getElementById("ch_line") as HTMLInputElement).valueAsNumber

    if (ch_col) {
        url_fragment.push(`ch_col=${ch_col}`)
        if (ch_fn !== "lin") {
            url_fragment.push(`ch_fn=${ch_fn}`)
        }
        if (ch_width !== 500) {
            url_fragment.push(`ch_width=${ch_width}`)
        }
        if (!isNaN(ch_min_setting)) {
            url_fragment.push(`ch_min_setting=${ch_min_setting}`)
        }
        if (!isNaN(ch_max_setting)) {
            url_fragment.push(`ch_max_setting=${ch_max_setting}`)
        }
        if (!isNaN(ch_line)) {
            url_fragment.push(`ch_line=${ch_line}`)
        }        
    }
    if (min_denom > 0.00101) {
        url_fragment.push(`min_denom=${min_denom}`)
    }

    let ch_filter : (x:number) => number
    switch (ch_fn) {
        case "ln":
            ch_filter = x => Math.log(x)
            break
        case "sqrt":
            ch_filter = x => Math.sqrt(x)
            break
        case "cbrt":
            ch_filter = x => Math.cbrt(x)
            break
        case "atan10":
            ch_filter = x => Math.atan(x*0.1)
            break
        case "atan1000":
            ch_filter = x => Math.atan(x*0.001)
            break
        default:
            ch_filter = x => x
    }

    let promoted_filters_n = 0
    let main_denom = window.content.main_denom

    let mins=new Array(nvalues+1).fill(Infinity);
    let maxes=new Array(nvalues+1).fill(-Infinity);

    let N_index = nvalues

    let chart_index = null

    if (main_denom !== null && ch_col === "N") {
        chart_index = N_index
    }

    for (const [i,v] of window.content.values.entries()) {
        if (ch_col === v.name) {
            chart_index  = i
        }
    }

    for (const s of window.content.filters) {
        let setting_selector = document.getElementById(`set_${s.name}`) as HTMLOptionElement;
        let sv = setting_selector.value

        filter_policies.push(sv)

        if (sv !== '*') {
            url_fragment.push(`${s.name}=${sv}`)
        }

        if (sv === "_COL") {
            let n = document.createElement("th");
            n.textContent = s.name;
            n.scope="col";
            colheads.appendChild(n);

            promoted_filters_n+=1;
        }
    }

    if (main_denom !== null)  {
        let n = document.createElement("th");
        
        let colname = "N"
        n.scope="col";

        let lbl = document.createElement("label")
        let chk = document.createElement("input")
        chk.type="checkbox"
        chk.id = `accent_N`
        chk.setAttribute("rote","switch")
        chk.checked = high_contrast_colorisations.has(colname)
        if (chk.checked) {
            url_fragment.push(`accent_N`)
        }
        chk.onchange =  function() { 
            handle_highcontrast_checkbox(colname)
        }
        chk.title=`Bright colorisation of {colname} column`
        lbl.textContent = colname;


        lbl.appendChild(chk)
        n.appendChild(lbl)
        colheads.appendChild(n);
    }

    for (const s of window.content.values) {
        let n = document.createElement("th");
        
        let colname = s.name
        n.scope="col";

        let lbl = document.createElement("label")
        let chk = document.createElement("input")
        chk.type="checkbox"
        chk.setAttribute("rote","switch")
        chk.id = `accent_${s.name}`
        highcontrast.push(high_contrast_colorisations.has(colname))
        chk.checked = high_contrast_colorisations.has(colname)
        chk.onchange =  function() { 
            handle_highcontrast_checkbox(colname)
        }
        if (chk.checked) {
            url_fragment.push(`accent_${s.name}`)
        }
        lbl.textContent = colname;
        chk.title=`Bright colorisation of '${colname}' column`

        lbl.appendChild(chk)
        n.appendChild(lbl)
        colheads.appendChild(n);

        value_nums.push(s.num)
        value_denoms.push(s.denom)
    }
    if (main_denom !== null)  {
        highcontrast.push(high_contrast_colorisations.has("N"))
    }

    if (chart_index !== null) {
        let n = document.createElement("th");
        n.scope="col";
        n.textContent="chart";
        colheads.appendChild(n);
    }

    let nfilters = filter_policies.length

    let rows = document.getElementById("the_rows") as HTMLTableSectionElement
    rows.replaceChildren()

    let db : Map<string, RowInfo> = new Map();

    for (const [row_index, filter_row] of window.content.filters_data.entries()) {
        let promoted_filters = []
        let matches_filter = true
        for (let i = 0; i<nfilters; i+=1) {
            let fv = filter_row[i];

            if (filter_policies[i] !== "*" && filter_policies[i] != "_COL" && filter_policies[i] != fv) {
                matches_filter = false
            }
        }

        if (!matches_filter) {
            continue
        }

        for (let i = 0; i<nfilters; i+=1) {
            let fv = filter_row[i];
            if (filter_policies[i] == "_COL") {
                promoted_filters.push(fv)
            }
        }

        let key = promoted_filters.join("|")
        let cursor : RowInfo
        if (db.has(key)) {
            cursor = db.get(key)
        } else {
            cursor = {
                promoted_filters: promoted_filters,
                values: new Array(values_rowlength).fill(0),
            }
        }

        let value_row = window.content.values_data[row_index]

        for (let j = 0; j<values_rowlength; j+=1) {
            let v = +value_row[j];
            cursor.values[j] += v;
            filtered_values[j] += v;
        }
        db.set(key, cursor)
    }

    let keys : string[] = [""]

    for (let i = 0; i<nfilters; i+=1) {   
        if (filter_policies[i] === "_COL") {
            let newkeys : string[] = []
            for (let x of window.content.filters[i].vals) {
                for (let k of keys) {
                    if (k.length === 0) {
                        newkeys.push(x)
                    } else {
                        newkeys.push(`${k}|${x}`)
                    }
                }
            }
            keys = newkeys;
        }
    }

    //console.log(keys)

    for (const [k, rr] of db) {
        for (let j = 0; j<nvalues; j+=1) {
            let num = rr.values[value_nums[j]]
            let denom = rr.values[value_denoms[j]]
            if (denom > min_denom) {
                let x = num / denom;
                if (x < mins[j]) mins[j] = x;
                if (x > maxes[j]) maxes[j] = x;
            } 
        }
        if (main_denom !== null) {
            let x = rr.values[main_denom]
            if (x < mins[N_index]) mins[N_index] = x;
            if (x > maxes[N_index]) maxes[N_index] = x;
        }
    }

    // Fill in the rows
    for (let k of keys) {
        if (!db.has(k)) {
            continue
        }
        let rr = db.get(k)
        //console.log(rr)

        let tr = document.createElement("tr")
        for (let k = 0; k<promoted_filters_n; k+=1) {
            let td = document.createElement("td")
            td.textContent = rr.promoted_filters[k]
            tr.appendChild(td)
        }

        let ch_x = null
        let ch_min = null
        let ch_max = null

        if (main_denom !== null) {
            let td = document.createElement("td");
            let x = rr.values[main_denom]

            if (relative_N) {
                let xx = 100.0*(x + 0.000005) / (filtered_values[main_denom] + 0.00001)
                td.textContent = `${xx.toFixed(2)}`
            } else {
                td.textContent = `${x}`
            }

            if (chart_index === N_index) {
                ch_x = x
                ch_min = 0
                ch_max = maxes[N_index]
            }

            let q = (x + 0.000005) / (maxes[N_index] + 0.00001)
            if (q>1.0) q=1.0;
            if (q<0.0) q=0.0;

            if (keys.length==1) {
                q = 0.0
            }

            let l
            let c
            if (darkMode) {
                if (highcontrast[N_index]) {
                    l=5+50*q
                    c=80*q
                } else {
                    l=2 + 15*q
                    c=60*q
                }
            } else {
                if (highcontrast[N_index]) {
                    l=100.0 - 40*q
                    c=40*q
                } else {
                    l=100 - 3*q
                    c=5*q
                }
            }
            let h = 190;
            td.setAttribute("style",`background-color: lch(${l} ${c} ${h})`);

            tr.appendChild(td)
        }
        for (let j = 0; j<nvalues; j+=1) {
            let td = document.createElement("td")
            
            let num = rr.values[value_nums[j]]
            let denom = rr.values[value_denoms[j]]

            if (denom > min_denom) {
                let x = num / denom

                if (chart_index === j) {
                    ch_x = x
                    ch_min = mins[j]
                    ch_max = maxes[j]
                }

                td.textContent = `${x.toFixed(2)}`

                let q = (x - mins[j] + 0.000005) / (maxes[j] - mins[j] + 0.00001)
                if (q>1.0) q=1.0;
                if (q<0.0) q=0.0;

                let qq = 0.5*Math.abs(q-0.5)

                let l
                if (darkMode) {
                    if (highcontrast[j]) {
                        l=10+70*qq
                    } else {
                        l=0 + 50*qq
                    }
                } else {
                    if (highcontrast[j]) {
                        l=100.0 - 90*qq
                    } else {
                        l=100
                    }
                }
                let c;

                if (darkMode) {
                    if (highcontrast[j]) {
                        c = 400*qq
                    } else {
                        c = 140*qq
                    }
                } else {
                    if (highcontrast[j]) {
                        c = 240*qq
                    } else {
                        c = 30*qq
                    }
                }
                let h;
                if (j % 2 == 0) {
                    h= (q>0.5) ? 0 : 210;
                } else  {
                    h= (q>0.5) ? 70 : 170;
                }
                td.setAttribute("style",`background-color: lch(${l} ${c} ${h})`);
                td.setAttribute("title", `${num} / ${denom}`);
            } else {
                td.textContent = ""
            }
            tr.appendChild(td)
        }
        // Chart area
        if (chart_index !== null) {
            let n = document.createElement("td");

            n.classList.add("ch_container")
            n.setAttribute("style", `width: ${ch_width}px`)

            let nn = document.createElement("div")
            nn.classList.add("ch_container2")
            n.appendChild(nn)

            nn.innerHTML="&nbsp;" // workaround to make height meaningful

            if (ch_x === null) {
                nn.classList.add('ch_missing')
            } else {
                nn.classList.add('ch_present')

                if (ch_min>-0.00001) ch_min=-0.00001
                if (ch_max<0.00001) ch_max=0.00001

                if (!isNaN(ch_min_setting)) {
                    ch_min = ch_min_setting
                }
                if (!isNaN(ch_max_setting)) {
                    ch_max = ch_max_setting
                }

                ch_min = ch_filter(ch_min)
                if (isNaN(ch_min)) {
                    ch_min=-0.00001
                }
                ch_max = ch_filter(ch_max)
                let line = ch_filter(ch_line)

                let zero_left = 0

                if (ch_min<0 && ch_max>0) {
                    zero_left = (0-ch_min) / (ch_max - ch_min) * ch_width
                    if (zero_left<=0) zero_left=0
                    if (zero_left>ch_width) zero_left=ch_width
                    let z = document.createElement('div')
                    z.classList.add("ch_zero")
                    z.setAttribute('style', `left: ${zero_left}px`)
                    nn.appendChild(z)
                } else if (ch_min<=0 && ch_max<=0) {
                    zero_left = ch_width
                }

                if (ch_min<line && ch_max>line) {
                    let left = (line - ch_min) / (ch_max - ch_min) * ch_width
                    if (left<=0) left=0
                    if (left>ch_width) left=ch_width
                    let z = document.createElement('div')
                    z.classList.add("ch_line")
                    z.setAttribute('style', `left: ${left}px`)
                    nn.appendChild(z)
                }

                let x : number = ch_x

                if (x >= 0 && ch_max>0) {
                    x = ch_filter(x)
                    let tip = (x - ch_min + 0.000005) / (ch_max - ch_min + 0.00001) * ch_width
                    let w

                    let z = document.createElement('div')

                    if (tip > ch_width) {
                        w = ch_width - zero_left
                        z.classList.add("ch_pos_over")
                    } else {
                        w = tip - zero_left
                        z.classList.add("ch_pos")
                    }

                    z.classList.add("ch_bar")
                    z.setAttribute('style', `left: ${zero_left}px; width: ${w}px`)
                    nn.appendChild(z)
                } else if (x>=0 && ch_max<=0) {
                    n.classList.add('ch_pos_over_invisible')
                } else if (x<0 && ch_min<0) {
                    x = ch_filter(x)
                    let tip = (x - ch_min + 0.000005) / (ch_max - ch_min + 0.00001) * ch_width
                    let left
                    let w

                    let z = document.createElement('div')

                    if (tip < 0) {
                        left = 0
                        w = zero_left - left
                        z.classList.add("ch_neg_over")
                    } else {
                        left = tip
                        w = zero_left - tip
                        z.classList.add("ch_neg")
                    }
                    

                    z.classList.add("ch_bar")
                    z.setAttribute('style', `left: ${left}px; width: ${w}px`)
                    nn.appendChild(z)
                } else if (x<0 && ch_min>=0) {
                    n.classList.add('ch_neg_over_invisible')
                }

            }
            tr.appendChild(n);
        }
        rows.appendChild(tr)
    }

    let totperc_row =  document.getElementById("totperc_row") as HTMLTableRowElement;
    totperc_row.replaceChildren()

    for (let j=0; j<promoted_filters_n; j+=1) {
        totperc_row.appendChild(document.createElement("td"))
    }
    if (main_denom !== null) {
        let n = document.createElement("td")
        totperc_row.appendChild(n)

        n.scope="col";

        let lbl = document.createElement("label")
        let chk = document.createElement("input")
        chk.type="checkbox"
        chk.id = `relative_N`
        chk.checked = relative_N
        chk.onchange =  function() { 
            relative_N = !relative_N
            build_main_table()
        }
        if (chk.checked) {
            url_fragment.push(`relative_N`)
        }
        lbl.textContent = "%";
        chk.setAttribute("rote","switch")
        chk.title=`Percentage from total instead of absolute numbers for the N column`

        lbl.appendChild(chk)
        n.appendChild(lbl)
    }
    for (let j=0; j<nvalues; j+=1) {

        let td = document.createElement("td")

        if (window.total_values[value_denoms[j]] > min_denom) {
            let x = 100.0*filtered_values[value_denoms[j]] / window.total_values[value_denoms[j]];
            td.textContent = `${x.toFixed(2)}%`
        } else {
            td.textContent = "-"
        }
        totperc_row.appendChild(td)
    }
    if (chart_index !== null) {
        let n = document.createElement("td");
        totperc_row.appendChild(n);
    } 

    let avgs_row = document.getElementById("avgs_row") as HTMLTableRowElement;
    avgs_row.replaceChildren()

    for (let j=0; j<promoted_filters_n; j+=1) {
        avgs_row.appendChild(document.createElement("td"))
    }
    if (main_denom !== null) {
        let td = document.createElement("td")
        avgs_row.appendChild(td)
        td.textContent = `${filtered_values[main_denom]}`
    }
    for (let j=0; j<nvalues; j+=1) {

        let td = document.createElement("td")

        let num = filtered_values[value_nums[j]]
        let denom = filtered_values[value_denoms[j]]
        if (denom > min_denom) {
            let x = 1.0*num/denom
            td.textContent = `${x.toFixed(2)}`
            td.setAttribute("title", `${num} / ${denom}`);
        } else {
            td.textContent = ""
        }
        avgs_row.appendChild(td)
    }   
    if (chart_index !== null) {
        let n = document.createElement("td");
        avgs_row.appendChild(n);
    }

    let show_desc_ck = document.getElementById("show_description") as HTMLInputElement

    if (show_desc_ck.checked) {
        url_fragment.push(`show_description`)
    }

    //window.location.hash=url_fragment.join('&')
    window.history.replaceState(null, null, '#' + url_fragment.join('&'));
}

function build_settings_pane() {
    let values_rowlength = window.content.values_data[0].length

    window.total_values = new Array(values_rowlength).fill(0)
    for (const x of window.content.values_data) {
        for (const [i, v] of x.entries()) {
            window.total_values[i] += v
        }
    }

    let default_values: Map<string, string> = new Map()

    let ch_col = document.getElementById("ch_col") as HTMLSelectElement
    let show_desc_ck = document.getElementById("show_description") as HTMLInputElement
    let description = document.getElementById("description") as HTMLParagraphElement

    if (window.content.main_denom !== null) {
        let x = document.createElement("option")
        x.setAttribute("value", "N");
        x.textContent = "N"
        ch_col.appendChild(x)
    }

    for (const v of window.content.values) {
        let x = document.createElement("option")
        x.setAttribute("value", v.name);
        x.textContent = v.name
        ch_col.appendChild(x)
    }

    for (const x of window.location.hash.substring(1).split('&')) {
        if (x === "relative_N") {
            relative_N = true
            continue
        }
        else if (x.startsWith("accent_")) {
            let n = x.substring(7)
            high_contrast_colorisations.add(n)
            continue
        }
        else if (x === "show_description") {
            show_desc_ck.checked = true
            continue
        }

        const a = x.split('=',2)
        default_values.set(decodeURIComponent(a[0]), decodeURIComponent(a[1]))

        if (!a[0]) {
            continue
        }

        let some_input_element = document.getElementById(a[0]) as HTMLInputElement
        if (some_input_element) {
            some_input_element.value = a[1]
        }
    }

    let settings = document.getElementById("settings") as HTMLDivElement;
    
    for (const s of window.content.filters) {
        let name = s.name

        let lbl = document.createElement("label")
        lbl.textContent = name
        lbl.setAttribute("for", `set_${name}`)
        settings.appendChild(lbl)

        let slct = document.createElement("select")
        slct.setAttribute("name", `set_${name}`)
        slct.setAttribute("id", `set_${name}`)
        slct.onchange = () => build_main_table()
        settings.appendChild(slct)

        let col_opt = document.createElement("option")
        col_opt.setAttribute("value", "_COL");
        col_opt.textContent = "_COL"
        slct.appendChild(col_opt)

        let all_opt = document.createElement("option")
        all_opt.setAttribute("value", "*");
        all_opt.textContent = "*"
        slct.appendChild(all_opt)

        for (const v of s.vals) {
            let opt = document.createElement("option")
            opt.setAttribute("value", v);
            opt.textContent = v
            slct.appendChild(opt)
        }

        if (default_values.has(name)) {
            slct.value = default_values.get(name)
        } else {
            slct.value = "*"
        }
    }

    if (ch_col.value !== "") {
        let chk = document.getElementById("chart_toggle") as HTMLInputElement
        chk.checked=true
    }

    chart_settings_visibility_checkbox()

    if (!description.innerHTML.trim()) {
        show_desc_ck.setAttribute("style", "display: none")
    }
    show_description_checkbox();
}

function download() {
    let anchor = document.getElementById("download_anchor") as HTMLAnchorElement
    let line = []
    let chunks = []
    function commit_line() {
        chunks.push(line.join(",")+"\n")
        line=[]
    }
    for (const filter of window.content.filters) {
        line.push(filter.name)
    }
    if (window.content.main_denom !== null) {
        line.push("denom")
    }
    for (const value of window.content.values) {
        if(value.denom === window.content.main_denom) {
            line.push(`${value.name}_num`)
        } else {
            line.push(`${value.name}_num`)
            line.push(`${value.name}_denom`)
        }
    }
    commit_line();


    for (const [i, filters] of window.content.filters_data.entries()) {
        const values = window.content.values_data[i]
        for (const fv of filters) {
            line.push(fv)
        }
        if (window.content.main_denom !== null) {
            line.push(`${values[window.content.main_denom]}`)
        }

        for (const value of window.content.values) {
            if(value.denom === window.content.main_denom) {
                line.push(`${values[value.num]}`)
            } else {
                line.push(`${values[value.num]}`)
                line.push(`${values[value.denom]}`)
            }
        }
        commit_line();
    }


    const data = new Blob(chunks, { type: 'text/csv' });
    const url = URL.createObjectURL(data);
    anchor.href = url
    anchor.click()
}
