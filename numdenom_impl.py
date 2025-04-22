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

def quicktable(inputfile: str, outputfile: str) -> None:
    header_parsed = False
    header : List[str]
    filters : List[str] = []
    valcolumns : List[str] = []

    filtervals: Dict[str, Set[str]] = defaultdict(lambda:set())

    data: List[List[str|float]] = []
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
                    if x.endswith("_num") or x.endswith("_denom"):
                        valcolumns_tmp.add(x.removesuffix("_num").removesuffix("_denom"))
                    else:
                        filters_tmp.add(x)
                header_parsed = True
                filters = sorted(list(filters_tmp))
                valcolumns = sorted(list(valcolumns_tmp))
                #print(filters, valcolumns)
            else:
                # not header

                d_filters : Dict[str, str] = {}
                d_nums : Dict[str, float] = {}
                d_denoms : Dict[str, float] = {}

                for (i, x) in enumerate(row):
                    if i >= len(header): pass
                    h = header[i]

                    if h.endswith("_num"):
                        try:
                            v = float(x)
                        except:
                            print(f"Invalid number {x} for {h} on line {linectr}")
                            sys.exit(2)
                        d_nums[h.removesuffix("_num")] = v
                    elif h.endswith("_denom"):
                        try:
                            v = float(x)
                        except:
                            print(f"Invalid number {x} for {h} on line {linectr}")
                            sys.exit(2)
                        d_denoms[h.removesuffix("_denom")] = v
                    else:
                        filtervals[h].add(x)
                        d_filters[h] = x


                entry : List[float|str] = []

                for fff in filters:
                    if fff in d_filters:
                        entry.append(d_filters[fff])
                    else:
                        entry.append("NULL")
                
                for xxx in valcolumns:
                    if xxx in d_nums:
                        entry.append(d_nums[xxx])
                    else:
                        entry.append(0.0)
                        
                for xxx in valcolumns:
                    if xxx in d_denoms:
                        entry.append(d_denoms[xxx])
                    else:
                        entry.append(0.0)
                
                data.append(entry)
        # end iterating rows

    filtervals2 : List[Dict[str, Any]] = []

    for ffff in filters:
        vals = sorted(list(filtervals[ffff]))
        filtervals2.append({'name': ffff, 'vals': vals})
        

    datablock = json.dumps({'filters': filtervals2, 'values':valcolumns, 'data':data})
    subst = base64.standard_b64encode(gzip.compress(datablock.encode("UTF-8"))).decode("UTF-8")
    #print(subst)

    with open(outputfile, "wt") as of:
        txt : str = base64.standard_b64decode(HTML_TEMPLATE).decode("UTF-8")
        txt = txt.replace('%{data}', subst)
        txt = txt.replace('%{title}', Path(inputfile).stem)
        of.write(txt)


if __name__ == '__main__':
    if len(sys.argv)<3:
        print("Usage: quicktable.py input.csv output.html")
    else:
        quicktable(sys.argv[1], sys.argv[2])

