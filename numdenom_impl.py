#!/usr/bin/python

import sys
import gzip
import csv
import json
import base64
from collections import defaultdict
from pathlib import Path

from typing import List, Set, Dict, Any, Tuple

HTML_TEMPLATE=b"%{html_template}"

def quicktable(inputfile: str, outputfile: str, table_title: str) -> None:
    header_parsed = False
    header : List[str]
    filters : List[str] = []
    main_denom: int | None = None
    valcolumns : List[str] = []

    filter_indexes : Dict[str, int] = dict()
    value_num_indexes : Dict[str, int] = dict()
    value_denom_indexes : Dict[str, int] = dict()

    first_unused_filter_index = 0;
    first_unused_value_index = 0;

    filtervals: Dict[str, Set[str]] = defaultdict(lambda:set())

    filters_data: List[List[str]] = []
    values_data: List[List[float]] = []
    linectr = 0

    with open(inputfile, newline='') as f:
        ff = csv.reader(f)
        for row in ff:
            linectr+=1
            if not header_parsed:
                header = row

                filters_tmp : Set[str] = set([])
                valcolumns_tmp : Set[str] = set([])

                for x in row:
                    if x == "denom":
                        main_denom = first_unused_value_index
                        first_unused_value_index+=1
                    elif x.endswith("_num"):
                        rawcolname = x.removesuffix("_num")
                        valcolumns_tmp.add(rawcolname)
                        value_num_indexes[rawcolname] = first_unused_value_index
                        first_unused_value_index+=1
                    elif x.endswith("_denom"):
                        rawcolname = x.removesuffix("_denom")
                        valcolumns_tmp.add(rawcolname)
                        value_denom_indexes[rawcolname] = first_unused_value_index
                        first_unused_value_index+=1
                    else:
                        filters_tmp.add(x)
                        filter_indexes[x] = first_unused_filter_index
                        first_unused_filter_index+=1
                header_parsed = True
                filters = sorted(list(filters_tmp))
                valcolumns = sorted(list(valcolumns_tmp))
                #print(filters, valcolumns)
            else:
                # iterated csv row is not the header

                d_filters = [""] * first_unused_filter_index
                d_values = [0.0] * first_unused_value_index

                def parsenum(x : str) -> float:
                    x = x.strip()
                    if x == "" or x == "NULL":
                        raise ValueError
                    try:
                        v = float(x)
                        return v
                    except:
                        print(f"Invalid number {x} for {h} on line {linectr}")
                        sys.exit(2)

                for (i, x) in enumerate(row):

                    if i >= len(header): pass
                    h = header[i]

                    try:
                        if h == "denom":
                            assert main_denom is not None
                            d_values[main_denom] = parsenum(x)
                        elif h.endswith("_num"):
                            rawcolname = h.removesuffix("_num")
                            d_values[value_num_indexes[rawcolname]] = parsenum(x)
                        elif h.endswith("_denom"):
                            rawcolname = h.removesuffix("_denom")
                            d_values[value_denom_indexes[rawcolname]] = parsenum(x)
                        else:
                            filtervals[h].add(x)
                            d_filters[filter_indexes[h]] = x
                    except ValueError:
                        # ignore explicit ValueErrors from `parsenum`, but not other things
                        pass


                filters_entry : List[str] = []
                values_entry : List[float] = []

                filters_data.append(d_filters)
                values_data.append(d_values)
        # end iterating rows

    filtervals2 : List[Dict[str, Any]] = []
    valcolinfos: List[Dict[str, Any]] = []

    for ffff in filters:
        vals = sorted(list(filtervals[ffff]))
        filtervals2.append({'name': ffff, 'vals': vals})

    for valcol in valcolumns:
        if valcol not in value_denom_indexes and main_denom is None:
            print(f"Value column `{valcol}` has only numerator (`{valcol}_num`), but not denominator (`{valcol}_denom`) and there is no main denominator (`denom`)")
            sys.exit(2)
        if valcol not in value_num_indexes:
            print(f"Value column `{valcol}` has only denominator (`{valcol}_denum`), but not numerator (`{valcol}_num`)")
            sys.exit(2)
        numindex = value_num_indexes[valcol]
        denomindex : int
        if valcol in value_denom_indexes:
            denomindex =value_denom_indexes[valcol]
        else:
            assert main_denom is not None
            denomindex = main_denom
        valcolinfos.append({'name': valcol, 'num' : numindex, 'denom': denomindex})

    if not filters:
        print("There are no filter columns. Usefullness of the table is questionable.")

    if not valcolumns:
        print("There are no value columns (ending with `_num` or `_denom`). Usefullness of the table is questionable.")
        
    datablock = json.dumps({
        'filters': filtervals2,
        'values':valcolinfos,
        'filters_data':filters_data,
        'values_data':values_data,
        'main_denom': main_denom,
        })
    #print(datablock)
    subst = base64.standard_b64encode(gzip.compress(datablock.encode("UTF-8"))).decode("UTF-8")
    #print(subst)

    with open(outputfile, "wt") as of:
        txt : str = base64.standard_b64decode(HTML_TEMPLATE).decode("UTF-8")
        txt = txt.replace('%{data}', subst)
        txt = txt.replace('%{title}', table_title)
        of.write(txt)


if __name__ == '__main__':
    if len(sys.argv)<3:
        print("Usage: quicktable.py input.csv output.html [title]")
    else:
        inputfile = sys.argv[1]
        table_title = Path(inputfile).stem
        if len(sys.argv)>=4:
            table_title = sys.argv[3]
        quicktable(sys.argv[1], sys.argv[2], table_title)

