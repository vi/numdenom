import base64
import sys

if len(sys.argv) < 3:
    print("Usage: subst_base64 substring_to_substitude data_to_base64_and_insert > output < input")
    exit(1)

pattern : str = sys.argv[1]
with open(sys.argv[2], "rb") as f:
    subst = base64.standard_b64encode(f.read()).decode("UTF-8")

for line in sys.stdin:
    line = line.replace(pattern,subst)
    sys.stdout.write(line)
