numdenom.py: numdenom_impl.py page.html subst_base64.py
	python3 subst_base64.py  '%{html_template}' page.html < numdenom_impl.py > numdenom.py
	chmod +x numdenom.py

page.html: page.html.in qktbl.js style.css
	cat page.html.in \
		| python3 subst.py '%{style}' style.css \
		| python3 subst.py '%{code}' qktbl.js \
		> page.html

qktbl.js: qktbl.ts
	tsc
