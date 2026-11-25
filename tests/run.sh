#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
jsc="/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"

if [ ! -x "$jsc" ]; then
  echo "JavaScriptCore (jsc) not found at $jsc" >&2
  exit 1
fi

cd "$root"
"$jsc" tests/main.test.js
