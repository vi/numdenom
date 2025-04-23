type Content = IContent
type NumOrStr = string | number;

interface IContent {
  filters: IFilter[];
  values: string[];
  data: NumOrStr[][];
}

interface IFilter {
  name: string;
  vals: string[];
}

interface Window {
    compressed_data: string;
    content: Content;
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
    nums: number[];
    denoms: number[];

    promoted_filters: string[];
}
type RowInfo = IRowInfo

let high_contrast_colorisations : Set<string> = new Set()

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

    let filter_policies = []

    let total_denoms = []
    let filtered_nums = []
    let filtered_denoms = []
    let highcontrast = []

    let min_denom = (document.getElementById("min_denom") as HTMLInputElement).valueAsNumber

    let promoted_filters_n = 0

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

    for (const s of window.content.values) {
        let n = document.createElement("th");
        
        n.scope="col";

        let lbl = document.createElement("label")
        let chk = document.createElement("input")
        chk.type="checkbox"
        highcontrast.push(high_contrast_colorisations.has(s))
        chk.checked = high_contrast_colorisations.has(s)
        chk.onchange =  function() { 
            handle_highcontrast_checkbox(s)
        }
        lbl.textContent = s;

        lbl.appendChild(chk)
        n.appendChild(lbl)
        colheads.appendChild(n);

        total_denoms.push(0)
        filtered_nums.push(0)
        filtered_denoms.push(0)
    }

    let nfilters = filter_policies.length
    let nvalues = window.content.values.length

    let first_data_row = true

    let rows = document.getElementById("the_rows") as HTMLTableSectionElement
    rows.replaceChildren()

    let db : Map<string, RowInfo> = new Map();

    for (const d of window.content.data) {
        let promoted_filters = []
        let matches_filter = true
        for (let i = 0; i<nfilters; i+=1) {
            let fv = d[i];
            
            if (filter_policies[i] !== "*" && filter_policies[i] != "_COL" && filter_policies[i] != fv) {
                matches_filter = false
            }
        }

        for (let j = 0; j<nvalues; j+=1) {
            let v = d[nfilters + nvalues + j];
            total_denoms[j] += v;
        }

        if (!matches_filter) {
            continue
        }

        for (let i = 0; i<nfilters; i+=1) {
            let fv = d[i];
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
                nums: new Array(nvalues).fill(0),
                denoms: new Array(nvalues).fill(0),
            }
        }

        for (let j = 0; j<nvalues; j+=1) {
            let v = +d[nfilters + j];
            cursor.nums[j] += v;
            filtered_nums[j] += v;
        }
        for (let j = 0; j<nvalues; j+=1) {
            let v = +d[nfilters + nvalues + j];
            cursor.denoms[j] += v;
            filtered_denoms[j] += v;
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

    let mins=new Array(nvalues).fill(Infinity);
    let maxes=new Array(nvalues).fill(-Infinity);

    for (const [k, rr] of db) {
        for (let j = 0; j<nvalues; j+=1) {
            if (rr.denoms[j] > min_denom) {
                let x = rr.nums[j] / rr.denoms[j];
                if (x < mins[j]) mins[j] = x;
                if (x > maxes[j]) maxes[j] = x;
            } 
        }
    }


    for (let k of keys) {
        if (db.has(k)) {
            let rr = db.get(k)

            let tr = document.createElement("tr")
            for (let k = 0; k<promoted_filters_n; k+=1) {
                let td = document.createElement("td")
                td.textContent = rr.promoted_filters[k]
                tr.appendChild(td)
            }
            for (let j = 0; j<nvalues; j+=1) {
                let td = document.createElement("td")
    
                if (rr.denoms[j] > min_denom) {
                    let x = rr.nums[j] / rr.denoms[j];
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
    for (let j=0; j<nvalues; j+=1) {

        let td = document.createElement("td")

        if (total_denoms[j] > min_denom) {
            let x = 100.0*filtered_denoms[j] / total_denoms[j];
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
    for (let j=0; j<nvalues; j+=1) {

        let td = document.createElement("td")

        if (filtered_denoms[j] > min_denom) {
            let x = 1.0*filtered_nums[j] / filtered_denoms[j];
            td.textContent = `${x.toFixed(2)}`
        } else {
            td.textContent = ""
        }
        avgs_row.appendChild(td)
    }

    
}


function build_settings_pane() {
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

        slct.value = "*"
    }
}
