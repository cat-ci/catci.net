import os
import io
import zipfile
import tempfile
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from PIL import Image, ImageTk
import shutil


class ImageResizerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Batch Image Resizer ZIP Tool")

        self.images = []  # each entry is {path, name, preview, width_var, height_var, include_var}
        self.temp_dir = tempfile.mkdtemp()

        # --- UI Layout ---
        ttk.Button(root, text="Upload ZIP", command=self.load_zip).pack(pady=10)
        self.canvas = tk.Canvas(root, bg="white")
        self.scroll_y = tk.Scrollbar(root, orient="vertical", command=self.canvas.yview)
        self.frame = ttk.Frame(self.canvas)

        self.frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")),
        )
        self.canvas.create_window((0, 0), window=self.frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scroll_y.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scroll_y.pack(side="right", fill="y")

        ttk.Button(root, text="Resize & Download ZIP", command=self.process_images).pack(
            pady=10
        )

    def load_zip(self):
        file_path = filedialog.askopenfilename(
            title="Select ZIP File",
            filetypes=[("ZIP files", "*.zip")],
        )
        if not file_path:
            return

        # cleanup previous
        for widget in self.frame.winfo_children():
            widget.destroy()
        self.images.clear()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        self.temp_dir = tempfile.mkdtemp()

        try:
            with zipfile.ZipFile(file_path, "r") as zip_ref:
                zip_ref.extractall(self.temp_dir)
        except Exception as e:
            messagebox.showerror("Error", f"Could not unzip file:\n{e}")
            return

        self.display_images()

    def display_images(self):
        img_extensions = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif")
        row = 0
        col = 0
        for root_dir, _, files in os.walk(self.temp_dir):
            for fname in files:
                if not fname.lower().endswith(img_extensions):
                    continue
                full_path = os.path.join(root_dir, fname)
                try:
                    img = Image.open(full_path)
                    img.thumbnail((100, 100))
                    tk_img = ImageTk.PhotoImage(img)
                except Exception:
                    continue

                frame = ttk.Frame(self.frame, relief="ridge", padding=5)
                frame.grid(row=row, column=col, padx=10, pady=10)

                label_img = ttk.Label(frame, image=tk_img)
                label_img.image = tk_img
                label_img.pack()

                ttk.Label(frame, text=fname).pack()

                width_var = tk.StringVar()
                height_var = tk.StringVar()
                include_var = tk.BooleanVar(value=True)

                entry_frame = ttk.Frame(frame)
                entry_frame.pack(pady=3)
                ttk.Label(entry_frame, text="W:").pack(side="left")
                ttk.Entry(entry_frame, textvariable=width_var, width=5).pack(side="left")
                ttk.Label(entry_frame, text="H:").pack(side="left")
                ttk.Entry(entry_frame, textvariable=height_var, width=5).pack(side="left")

                ttk.Checkbutton(frame, text="Include", variable=include_var).pack()

                self.images.append(
                    {
                        "path": full_path,
                        "name": fname,
                        "width_var": width_var,
                        "height_var": height_var,
                        "include_var": include_var,
                    }
                )

                col += 1
                if col >= 4:
                    col = 0
                    row += 1

    def process_images(self):
        if not self.images:
            messagebox.showwarning("No Images", "Please upload a ZIP of images first.")
            return

        save_path = filedialog.asksaveasfilename(
            defaultextension=".zip",
            filetypes=[("ZIP files", "*.zip")],
            title="Save Resized Images ZIP As...",
        )
        if not save_path:
            return

        output_dir = tempfile.mkdtemp()

        processed_count = 0
        for img_data in self.images:
            if not img_data["include_var"].get():
                continue
            path = img_data["path"]
            width_str = img_data["width_var"].get().strip()
            height_str = img_data["height_var"].get().strip()

            try:
                img = Image.open(path)
                width = int(width_str) if width_str else img.width
                height = int(height_str) if height_str else img.height
                img = img.resize((width, height), Image.Resampling.LANCZOS)
                output_file = os.path.join(output_dir, img_data["name"])
                img.save(output_file)
                processed_count += 1
            except Exception as e:
                print(f"Skipping {img_data['name']} due to error: {e}")

        if processed_count == 0:
            messagebox.showinfo("No images processed", "No images were included.")
            return

        # Create ZIP
        with zipfile.ZipFile(save_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for fname in os.listdir(output_dir):
                fpath = os.path.join(output_dir, fname)
                zipf.write(fpath, arcname=fname)

        shutil.rmtree(output_dir, ignore_errors=True)
        messagebox.showinfo("Success", f"Resized images saved to:\n{save_path}")


if __name__ == "__main__":
    root = tk.Tk()
    app = ImageResizerApp(root)
    root.geometry("900x600")
    root.mainloop()