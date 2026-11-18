from django.core.exceptions import ValidationError

MAX_BYTES = 1024 * 1024


def sniff(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def read_image(upload):
    """Возвращает (bytes, content_type) или бросает ValidationError. SVG не допускается."""
    if upload.size > MAX_BYTES:
        raise ValidationError("Файл больше 1 МБ")
    data = upload.read()
    kind = sniff(data)
    if not kind:
        raise ValidationError("Допустимы только PNG, JPEG или WebP")
    return data, kind
