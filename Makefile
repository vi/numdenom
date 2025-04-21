quicktable.py: quicktable_impl.py page.html subst_base64.py
	python3 subst_base64.py  '<HTML_TEMPLATE>' page.html < quicktable_impl.py > quicktable.py
	chmod +x quicktable.py
