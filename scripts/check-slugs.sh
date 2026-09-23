#!/bin/sh
# DESC: 발행 전 slug 충돌 검사. permalinks = '/:slug/' 라서 slug가 겹치면
#       늦은 글이 이기고 옛 글 페이지가 조용히 사라진다. Hugo는 경고하지 않는다.
# 사용: sh scripts/check-slugs.sh   (0=통과, 1=충돌)
set -e
cd "$(dirname "$0")/.."
dup=$(grep -h '^slug:' content/posts/*.md | sed 's/slug: *//; s/"//g' | sort | uniq -d)
if [ -n "$dup" ]; then
  echo "슬러그 충돌 — 발행 중단:" >&2
  echo "$dup" | while read -r s; do
    echo "  /$s/" >&2
    grep -l "^slug: \"$s\"$" content/posts/*.md | sed 's/^/      /' >&2
  done
  exit 1
fi
echo "slug 충돌 없음 ($(ls content/posts/*.md | wc -l | tr -d ' ')편)"
