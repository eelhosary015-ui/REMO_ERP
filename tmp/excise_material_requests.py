import io, sys

path = "modules/warehouses/routes/enterprise_inventory.routes.ts"
with io.open(path, "r", encoding="utf-8", newline="") as f:
    text = f.read()

start_marker = "// 5. MATERIAL REQUESTS & ISSUES (Outbound Consumptions)"
end_marker = "// 6. STOCK RESERVATIONS ENGINE"

if text.count(start_marker) != 1 or text.count(end_marker) != 1:
    sys.exit(f"markers not unique: start={text.count(start_marker)} end={text.count(end_marker)}")

start = text.index(start_marker)
# back up to the opening banner line of the section
banner = text.rfind("// \u2550", 0, start)
start = banner if banner != -1 else start
end = text.index(end_marker)
# back up to the banner that precedes the end marker
banner_end = text.rfind("// \u2550", 0, end)
end = banner_end if banner_end != -1 else end

replacement = (
    "// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
    "// 5. MATERIAL REQUESTS & ISSUES (Outbound Consumptions)\n"
    "// \u2500\u2500 Moved to ./material_requests.routes.ts \u2500\u2500\n"
    "// The old handlers lived here and wrote to columns that legacy databases do\n"
    "// not have (approved_by_dept, approved_wh_at, issued_at ...), so every\n"
    "// approval/issue call failed. The rewritten router is mounted before this\n"
    "// one in warehouses_api.routes.ts and owns every /api/material-requests path.\n"
    "// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n"
)

removed = text[start:end]
text = text[:start] + replacement + text[end:]

with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(text)

lines = removed.count("\n")
print(f"removed {lines} lines, file now {text.count(chr(10)) + 1} lines")
