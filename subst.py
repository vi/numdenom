import sys

if len(sys.argv) < 3:
    print("Usage: subst substring_to_substitude file_to_insert > output < input")
    exit(1)

pattern : str = sys.argv[1]
with open(sys.argv[2], "rb") as f:
    subst = f.read().decode("UTF-8")

for line in sys.stdin:
    line = line.replace(pattern,subst)
    sys.stdout.write(line)
