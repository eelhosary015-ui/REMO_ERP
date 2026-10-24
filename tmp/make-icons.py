from PIL import Image
src = r".zwork/attachments/ac0d0916-321f-41b1-bc83-45253add5823/image.png"
im = Image.open(src).convert("RGBA")
w, h = im.size
side = max(w, h)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)

canvas.resize((32, 32), Image.LANCZOS).save("public/favicon-32.png")
canvas.resize((64, 64), Image.LANCZOS).save("public/favicon-64.png")
canvas.resize((192, 192), Image.LANCZOS).save("public/favicon-192.png")
canvas.resize((512, 512), Image.LANCZOS).save("public/favicon-512.png")

# Apple touch icon: خلفية بيضاء معتمة (iOS لا يدعم الشفافية)
apple = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
inner = canvas.resize((140, 140), Image.LANCZOS)
apple.paste(inner, (20, 20), inner)
apple.convert("RGB").save("public/apple-touch-icon.png")

# favicon.ico متعدد الأحجام
canvas.save("public/favicon.ico", sizes=[(16,16),(32,32),(48,48)])
print("icons generated")
