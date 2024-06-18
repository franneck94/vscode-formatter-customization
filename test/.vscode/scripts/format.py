import json
import os
import re
import sys
import shutil
from subprocess import Popen, PIPE
import platform


system_platform = platform.system()
if system_platform == "Windows":
    is_win = True
else:
    is_win = False


def makeAbs(path: str) -> str:
    if not os.path.isabs(path):
        return os.path.join(os.path.dirname(__file__), os.path.normpath(path))
    else:
        return os.path.normpath(path)


def indent(
    content: str,
    num_indents: int,
    num_whitespaces_per_indent: int,
    is_else_if: bool = False,
) -> str:
    add_space_to_indent = 1 if is_else_if else 0
    return "{indent}{content}".format(
        indent=" " * (num_indents * num_whitespaces_per_indent + add_space_to_indent),
        content=content.strip(),
    )


def is_tool(name: str) -> bool:
    return shutil.which(name) is not None


clang_exe = "clang-format.exe" if is_win else "clang-format"
style_file = ".clang-format"
num_whitespaces_per_indent = 4
extraWhitespaces = 0

with open("{}/format.json".format(os.path.dirname(__file__))) as config_file:
    config_json = json.load(config_file)
    clang_exe = (
        (config_json["clang_exe"] + ".exe") if is_win else config_json["clang_exe"]
    )
    style_file = config_json["style_file"]
    num_whitespaces_per_indent = int(config_json["indent_count"])
    extraWhitespaces = int(config_json["extra_whitespaces"])


style_file = makeAbs(style_file)
clang_exe = makeAbs(clang_exe) if is_win else clang_exe

lines = sys.stdin.readlines()
fixed_lines = []

# Check if user has installed clang-format on WSL
if not is_win and not is_tool(clang_exe):
    for line in lines:
        print(line, end="")
    sys.exit(
        f"\n'{clang_exe}' command is not found - you may need to install the formatter tool."
        "\nType in shell: sudo apt-get install clang-format"
        "\nAfterwards this formatting command will work properly\n\n"
    )
elif is_win and is_tool("clang-format.exe"):
    clang_exe = "clang-format.exe"  # Use globally installed clang-format instead

for line in lines:
    if line[-3:] == "//\n":
        fixed_lines.append("// clang-format off\n")
    fixed_lines.append(line)
    if line[-3:] == "//\n":
        fixed_lines.append("// clang-format on\n")

lines = fixed_lines

# Start clang format with file content send via stdin, and formatted content via stdout
try:
    p = Popen(
        [clang_exe, "--style=file:{}".format(style_file)],
        stdout=PIPE,
        stdin=PIPE,
        stderr=PIPE,
    )
    comm = p.communicate(input="".join(lines).encode("utf-8"))
except FileNotFoundError:
    sys.exit(
        "Clang-Format Command not Found!\nYou may need to install it or add it to PATH."
    )

line = comm[0].decode(encoding="utf-8")
if comm[1]:
    sys.exit("Unknown Error: ", comm[1])
lines = line.split("\n")
line_iter = iter(lines)

# Here starts the ZF defined deviations from clang-format
for line in line_iter:
    is_doxygen_comment = line[:2] == " *"
    full_line_is_regular_comment = line.strip()[:2] == "/*"
    is_empty_scope_with_comment_only = (
        line.strip()[:4] == "{ /*" or line.strip()[:4] == "{ //"
    )
    if "// clang-format off" in line or "// clang-format on" in line:
        # Remove inserted clang-format-on/off statements
        continue

    use_line = " if" in line
    do_not_ignore_line = (
        line[-2:] != "//"
        and not is_doxygen_comment
        and not full_line_is_regular_comment
    )

    if use_line and do_not_ignore_line:
        line = line.strip("\n").strip("\r")
        inner_indent = 0
        full_if = line
        while full_if.count("(") - full_if.count(")") > 0:
            full_if += " " + next(line_iter, "").strip()
        base_indent_lvl = round(
            (len(full_if) - len(full_if.lstrip(" "))) / num_whitespaces_per_indent
        )

        iterator = iter(re.split(r"(\&{2}|\|{2})", full_if))
        output = indent(
            next(iterator, ""), base_indent_lvl, num_whitespaces_per_indent, False
        )
        inner_indent += output.count("(") - output.count(")")
        if "else if" in line:
            indent_offset = 1
            is_else_if = True
        else:
            indent_offset = 0
            is_else_if = False
        if inner_indent > 0:
            output += "\n"
        for outline in iterator:
            content = outline.rstrip() + " " + next(iterator, "").lstrip()
            num_indents = base_indent_lvl + inner_indent + indent_offset
            output += " " * extraWhitespaces + indent(
                content,
                num_indents,
                num_whitespaces_per_indent,
                is_else_if,
            )
            inner_indent += content.count("(") - content.count(")")
            if inner_indent > 0:
                output += "\n"
        print(output)
    elif is_empty_scope_with_comment_only:
        split_idx = line.find("{") + 1
        print(line[:split_idx])
        print(line[: split_idx - 1] + "\t" + line[split_idx + 1 :])
    else:
        print(line)
