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

function build_main_table() {
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

    let promoted_filters_n = 0
    let main_denom = window.content.main_denom

    for (const s of window.content.filters) {
        let setting_selector = document.getElementById(`set_${s.name}`) as HTMLOptionElement;
        filter_policies.push(setting_selector.value)

        if (setting_selector.value === "_COL") {
            let n = document.createElement("th");
            n.textContent = s.name;
            n.scope="col";
            colheads.appendChild(n);

            promoted_filters_n+=1;
        }
    }

    if (main_denom != null)  {
        let n = document.createElement("th");
        
        let colname = "N"
        n.scope="col";

        let lbl = document.createElement("label")
        let chk = document.createElement("input")
        chk.type="checkbox"
        chk.checked = high_contrast_colorisations.has(colname)
        chk.onchange =  function() { 
            handle_highcontrast_checkbox(colname)
        }
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
        highcontrast.push(high_contrast_colorisations.has(colname))
        chk.checked = high_contrast_colorisations.has(colname)
        chk.onchange =  function() { 
            handle_highcontrast_checkbox(colname)
        }
        lbl.textContent = colname;

        lbl.appendChild(chk)
        n.appendChild(lbl)
        colheads.appendChild(n);

        value_nums.push(s.num)
        value_denoms.push(s.denom)
    }
    if (main_denom != null)  {
        highcontrast.push(high_contrast_colorisations.has("N"))
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

    let mins=new Array(nvalues+1).fill(Infinity);
    let maxes=new Array(nvalues+1).fill(-Infinity);

    let N_index = nvalues

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
        if (main_denom != null) {
            let x = rr.values[main_denom]
            if (x < mins[N_index]) mins[N_index] = x;
            if (x > maxes[N_index]) maxes[N_index] = x;
        }
    }


    for (let k of keys) {
        if (db.has(k)) {
            let rr = db.get(k)
            console.log(rr)

            let tr = document.createElement("tr")
            for (let k = 0; k<promoted_filters_n; k+=1) {
                let td = document.createElement("td")
                td.textContent = rr.promoted_filters[k]
                tr.appendChild(td)
            }

            if (main_denom != null) {
                let td = document.createElement("td");
                let x = rr.values[main_denom]

                if (relative_N) {
                    let xx = 100.0*(x + 0.000005) / (filtered_values[main_denom] + 0.00001)
                    td.textContent = `${xx.toFixed(2)}`
                } else {
                    td.textContent = `${x}`
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
                        l=10+70*q
                    } else {
                        l=0 + 50*q
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
            rows.appendChild(tr)
        }
    }

    let totperc_row =  document.getElementById("totperc_row") as HTMLTableRowElement;
    totperc_row.replaceChildren()

    for (let j=0; j<promoted_filters_n; j+=1) {
        totperc_row.appendChild(document.createElement("td"))
    }
    if (main_denom != null) {
        let n = document.createElement("td")
        totperc_row.appendChild(n)

        n.scope="col";

        let lbl = document.createElement("label")
        let chk = document.createElement("input")
        chk.type="checkbox"
        chk.checked = relative_N
        chk.onchange =  function() { 
            relative_N = !relative_N
            build_main_table()
        }
        lbl.textContent = "%";

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

    let avgs_row = document.getElementById("avgs_row") as HTMLTableRowElement;
    avgs_row.replaceChildren()

    for (let j=0; j<promoted_filters_n; j+=1) {
        avgs_row.appendChild(document.createElement("td"))
    }
    if (main_denom != null) {
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

    for (const x of window.location.hash.substring(1).split('&')) {
        const a = x.split('=')
        default_values.set(decodeURIComponent(a[0]), decodeURIComponent(a[1]))
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
}
