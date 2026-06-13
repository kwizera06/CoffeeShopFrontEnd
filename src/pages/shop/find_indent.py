
import os

filepath = r'c:\Users\hp\Desktop\Olitech CoffeeShop\CoffeeShop_Frontend\src\pages\shop\Owner.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    stripped = line.lstrip(' ')
    count = len(line) - len(stripped)
    if count in [24, 25]:
        print(f"Line {i+1}: {count} spaces - {stripped[:50].strip()}")
