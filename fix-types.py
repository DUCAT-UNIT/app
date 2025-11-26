#!/usr/bin/env python3
"""
Script to add TypeScript type annotations to component files
"""

import re
import os
from pathlib import Path

def fix_icon_props(content):
    """Fix icon component prop types"""
    # Pattern 1: ({ width, height })
    content = re.sub(
        r':\s*\(\{\s*width\s*,\s*height\s*\}\)',
        ': ({ width, height }: { width?: number; height?: number })',
        content
    )

    # Pattern 2: ({ width, height, color })
    content = re.sub(
        r":\s*\(\{\s*width\s*,\s*height\s*,\s*color\s*=\s*'#DDDDDD'\s*\}\)",
        ": ({ width, height, color = '#DDDDDD' }: { width?: number; height?: number; color?: string })",
        content
    )

    # Pattern 3: ({ width, height, color }) without default
    content = re.sub(
        r':\s*\(\{\s*width\s*,\s*height\s*,\s*color\s*\}\)',
        ': ({ width, height, color }: { width?: number; height?: number; color?: string })',
        content
    )

    return content

def fix_component_props(content):
    """Fix general component prop types"""
    lines = content.split('\n')
    new_lines = []

    for line in lines:
        # Skip already typed lines
        if ':' in line and ('}: {' in line or '): ' in line):
            new_lines.append(line)
            continue

        # Fix implicit any in destructured parameters
        # Pattern: function Component({ prop1, prop2 }) {
        match = re.match(r'^(export (?:default )?function \w+\(\{[^}]+\})\)( {)?$', line)
        if match:
            # This line needs an interface - we'll handle it separately
            pass

        new_lines.append(line)

    return '\n'.join(new_lines)

def process_file(file_path):
    """Process a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        # Apply fixes
        if '/icons/' in str(file_path):
            content = fix_icon_props(content)
        else:
            content = fix_component_props(content)

        # Only write if changed
        if content != original:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function"""
    components_dir = Path('components')

    if not components_dir.exists():
        print("components directory not found")
        return

    fixed_count = 0
    for tsx_file in components_dir.rglob('*.tsx'):
        if process_file(tsx_file):
            fixed_count += 1

    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == '__main__':
    main()
