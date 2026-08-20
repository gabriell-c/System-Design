import re
import os
from collections import Counter

base = r'd:\OmniRoute\system_design\web\src\lib'
out_path = r'd:\OmniRoute\system_design\web\src\lib\duplicates.txt'

def extract_ids(filepath):
    with open(os.path.join(base, filepath), 'r', encoding='utf-8') as f:
        content = f.read()
    return set(re.findall(r'id: "([^"]+)"', content))

main = extract_ids('catalog.ts')
network = extract_ids('catalog-network.ts')
patterns = extract_ids('catalog-patterns.ts')
multicloud = extract_ids('catalog-multicloud.ts')

all_ids_flat = []
for name, ids in [('catalog.ts', main), ('catalog-network.ts', network),
                   ('catalog-patterns.ts', patterns), ('catalog-multicloud.ts', multicloud)]:
    for id_val in ids:
        all_ids_flat.append((name, id_val))

counter = Counter(id_val for _, id_val in all_ids_flat)
duplicates = {k: v for k, v in counter.items() if v > 1}

all_unique = set(id_val for _, id_val in all_ids_flat)

lines = []
lines.append(f'Total unique IDs: {len(all_unique)}')
lines.append(f'Total IDs across all files: {len(all_ids_flat)}')
lines.append(f'Duplicates found: {len(duplicates)}')
lines.append('')
for id_val, count in sorted(duplicates.items()):
    sources = [name for name, id in all_ids_flat if id == id_val]
    lines.append(f'{id_val}: {count}x in {sources}')

with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('Done')
