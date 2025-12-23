#!/usr/bin/env python3
"""
Generate simple PNG icons for the Clipboard Vault Chrome extension.
Creates clipboard-themed icons with a modern gradient look.
"""

import zlib
import struct
import os

def create_png(width, height, pixels):
    """Create a PNG file from pixel data."""
    def make_chunk(chunk_type, data):
        chunk_len = struct.pack('>I', len(data))
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return chunk_len + chunk_type + data + chunk_crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = make_chunk(b'IHDR', ihdr_data)
    
    # IDAT chunk (image data)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # Filter byte (none)
        for x in range(width):
            raw_data += bytes(pixels[y][x])
    
    compressed = zlib.compress(raw_data, 9)
    idat = make_chunk(b'IDAT', compressed)
    
    # IEND chunk
    iend = make_chunk(b'IEND', b'')
    
    return signature + ihdr + idat + iend

def draw_icon(size):
    """Draw a clipboard icon with gradient background."""
    pixels = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]
    
    # Colors (RGBA)
    bg_top = (99, 102, 241, 255)      # Indigo
    bg_bottom = (79, 70, 229, 255)    # Darker indigo
    clip_color = (255, 255, 255, 255)  # White
    clip_dark = (200, 200, 220, 255)   # Light gray for depth
    
    # Calculate dimensions based on size
    margin = max(1, size // 8)
    corner_radius = max(2, size // 6)
    clip_top_height = max(2, size // 6)
    clip_top_width = max(4, size // 3)
    
    # Draw rounded rectangle background with gradient
    for y in range(size):
        for x in range(size):
            # Check if inside rounded rectangle
            in_rect = False
            
            # Main body check
            if margin <= x < size - margin and margin <= y < size - margin:
                # Check corners
                corners = [
                    (margin + corner_radius, margin + corner_radius),  # top-left
                    (size - margin - corner_radius - 1, margin + corner_radius),  # top-right
                    (margin + corner_radius, size - margin - corner_radius - 1),  # bottom-left
                    (size - margin - corner_radius - 1, size - margin - corner_radius - 1),  # bottom-right
                ]
                
                in_corner_region = False
                in_rounded_corner = False
                
                for cx, cy in corners:
                    # Check if in corner region
                    if ((x < margin + corner_radius or x >= size - margin - corner_radius) and 
                        (y < margin + corner_radius or y >= size - margin - corner_radius)):
                        in_corner_region = True
                        dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                        if dist <= corner_radius:
                            in_rounded_corner = True
                            break
                
                if in_corner_region:
                    in_rect = in_rounded_corner
                else:
                    in_rect = True
            
            if in_rect:
                # Gradient from top to bottom
                t = y / size
                r = int(bg_top[0] * (1 - t) + bg_bottom[0] * t)
                g = int(bg_top[1] * (1 - t) + bg_bottom[1] * t)
                b = int(bg_top[2] * (1 - t) + bg_bottom[2] * t)
                pixels[y][x] = (r, g, b, 255)
    
    # Draw clipboard clip at top (the metal part)
    clip_left = (size - clip_top_width) // 2
    clip_right = clip_left + clip_top_width
    clip_y_start = margin - max(1, size // 16)
    clip_y_end = margin + clip_top_height
    
    for y in range(max(0, clip_y_start), min(size, clip_y_end)):
        for x in range(clip_left, clip_right):
            if 0 <= x < size and 0 <= y < size:
                pixels[y][x] = clip_color
    
    # Draw clipboard body lines (paper lines)
    line_margin = margin + size // 5
    line_spacing = max(2, size // 6)
    line_height = max(1, size // 16)
    
    for i in range(3):
        line_y = line_margin + clip_top_height + i * line_spacing
        line_width = size - 2 * line_margin - (i * size // 8)  # Varying widths
        line_x_start = line_margin
        
        if line_y + line_height < size - margin:
            for y in range(line_y, min(line_y + line_height, size - margin)):
                for x in range(line_x_start, min(line_x_start + line_width, size - line_margin)):
                    if 0 <= x < size and 0 <= y < size:
                        # Semi-transparent white
                        pixels[y][x] = (255, 255, 255, 180)
    
    return pixels

def main():
    sizes = [16, 48, 128]
    icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    for size in sizes:
        pixels = draw_icon(size)
        png_data = create_png(size, size, pixels)
        
        filepath = os.path.join(icons_dir, f'icon{size}.png')
        with open(filepath, 'wb') as f:
            f.write(png_data)
        
        print(f'Created {filepath}')
    
    print('\nAll icons generated successfully!')

if __name__ == '__main__':
    main()

