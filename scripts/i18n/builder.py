import os
import re
import yaml

DOCS_DIR = "docs"

def transform_link(link: str, lang: str) -> str:
    link = link.strip()
    if link.startswith("http://") or link.startswith("https://") or link.startswith("mailto:") or link.startswith("#"):
        return link
    if link == "/studio/" or link.startswith("/studio/"):
        return link
    if link.startswith(f"/{lang}/"):
        return link
    if link.startswith("/"):
        return f"/{lang}{link}"
    return link

def transform_line_links(line: str, lang: str) -> str:
    # Match markdown links [text](/url)
    def repl(m):
        text = m.group(1)
        url = m.group(2)
        new_url = transform_link(url, lang)
        return f"[{text}]({new_url})"
    return re.sub(r'\[([^\]]+)\]\((/[^\)]+)\)', repl, line)

def build_localized_file(rel_path: str, lang: str, translations: dict):
    src_path = os.path.join(DOCS_DIR, rel_path)
    dst_path = os.path.join(DOCS_DIR, lang, rel_path)
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)

    with open(src_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Handle frontmatter if index.md
    if rel_path == "index.md" and content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            body_text = parts[2]
            try:
                fm = yaml.safe_load(fm_text)
                if isinstance(fm, dict):
                    if "hero" in fm and isinstance(fm["hero"], dict):
                        h = fm["hero"]
                        if "text" in h and h["text"] in translations:
                            h["text"] = translations[h["text"]]
                        if "tagline" in h and h["tagline"] in translations:
                            h["tagline"] = translations[h["tagline"]]
                        if "actions" in h and isinstance(h["actions"], list):
                            for act in h["actions"]:
                                if "text" in act and act["text"] in translations:
                                    act["text"] = translations[act["text"]]
                                if "link" in act:
                                    act["link"] = transform_link(act["link"], lang)
                    if "features" in fm and isinstance(fm["features"], list):
                        for feat in fm["features"]:
                            if "title" in feat and feat["title"] in translations:
                                feat["title"] = translations[feat["title"]]
                            if "details" in feat and feat["details"] in translations:
                                feat["details"] = translations[feat["details"]]
                fm_out = yaml.dump(fm, allow_unicode=True, sort_keys=False)
                content = f"---\n{fm_out}---\n{body_text}"
            except Exception as e:
                pass

    lines = content.split("\n")
    out_lines = []
    in_code = False
    in_frontmatter = False
    fm_dashes = 0

    for idx, line in enumerate(lines):
        trimmed = line.strip()

        # Track frontmatter
        if trimmed == "---":
            fm_dashes += 1
            if fm_dashes <= 2 and rel_path == "index.md":
                out_lines.append(line)
                continue

        if fm_dashes == 1 and rel_path == "index.md":
            out_lines.append(line)
            continue

        # Track code blocks
        if trimmed.startswith("```"):
            in_code = not in_code
            out_lines.append(line)
            continue

        if in_code:
            out_lines.append(line)
            continue

        # Vue components or HTML tags
        if trimmed.startswith("<") and trimmed.endswith(">"):
            out_lines.append(line)
            continue

        # Admonitions
        if trimmed.startswith(":::"):
            if trimmed == ":::":
                out_lines.append(":::")
            else:
                m = re.match(r"^:::\s*([a-zA-Z0-9_-]+)(.*)", trimmed)
                if m:
                    adm_type = m.group(1)
                    adm_title = m.group(2).strip()
                    if adm_title and adm_title in translations:
                        adm_title = translations[adm_title]
                    if adm_title:
                        out_lines.append(f"::: {adm_type} {adm_title}")
                    else:
                        out_lines.append(f"::: {adm_type}")
                else:
                    out_lines.append(line)
            continue

        # Check full line match
        if trimmed in translations:
            indent = line[:len(line) - len(line.lstrip())]
            out_lines.append(indent + translations[trimmed])
            continue

        # Headers
        if trimmed.startswith("#"):
            m = re.match(r"^(#+)\s*(.*)", trimmed)
            if m:
                hashes = m.group(1)
                htitle = m.group(2).strip()
                if htitle in translations:
                    htitle = translations[htitle]
                indent = line[:len(line) - len(line.lstrip())]
                out_lines.append(f"{indent}{hashes} {htitle}")
                continue

        # Table rows
        if trimmed.startswith("|") and trimmed.endswith("|"):
            if ":---" in trimmed or "---:" in trimmed:
                out_lines.append(line)
                continue
            cells = trimmed.split("|")
            new_cells = []
            for c in cells[1:-1]:
                c_clean = c.strip()
                if c_clean in translations:
                    c_clean = translations[c_clean]
                new_cells.append(f" {c_clean} ")
            out_lines.append("|" + "|".join(new_cells) + "|")
            continue

        # Bullet points
        m_bullet = re.match(r"^(\s*[-*]|\s*\d+\.)\s+(.*)", line)
        if m_bullet:
            prefix = m_bullet.group(1)
            btext = m_bullet.group(2).strip()
            if btext in translations:
                btext = translations[btext]
            else:
                btext = transform_line_links(btext, lang)
            out_lines.append(f"{prefix} {btext}")
            continue

        # General prose
        if trimmed:
            p_text = transform_line_links(trimmed, lang)
            indent = line[:len(line) - len(line.lstrip())]
            out_lines.append(indent + p_text)
        else:
            out_lines.append(line)

    result = "\n".join(out_lines)
    with open(dst_path, "w", encoding="utf-8") as f:
        f.write(result)

print("builder.py created successfully")
