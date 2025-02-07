import os
import requests

# URLs of the files to download
files = {
    "js": [
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    ],
    "css": [
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    ]
}

# Create assets folder
assets_folder = "assets"
os.makedirs(assets_folder, exist_ok=True)

# Function to download a file
def download_file(url, folder):
    local_filename = os.path.join(folder, url.split("/")[-1])
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(local_filename, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Downloaded: {local_filename}")
        return local_filename
    else:
        print(f"Failed to download: {url}")
        return None

# Download all files
downloaded_files = []
for file_type, urls in files.items():
    for url in urls:
        local_file = download_file(url, assets_folder)
        if local_file:
            downloaded_files.append((url, local_file))

# Update HTML links
# html_file = "location_map_0.337521_32.580924.html"  # Your HTML file
# if os.path.exists(html_file):
#     with open(html_file, "r") as f:
#         html_content = f.read()

#     for url, local_file in downloaded_files:
#         html_content = html_content.replace(url, local_file)

#     with open(html_file, "w") as f:
#         f.write(html_content)

#     print(f"Updated {html_file} to use local files.")
# else:
#     print(f"{html_file} not found. Ensure it is in the current directory.")
