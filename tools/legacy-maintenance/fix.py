import sys

with open('src/components/Costs.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The incorrect injection starts at index 5.
prefix = content[:5]
suffix = content[content.find('t React, { useState, useEffect } from \'react\';'):]
content = prefix + suffix

with open('src/components/Costs.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
