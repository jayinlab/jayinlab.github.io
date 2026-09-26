#!/bin/sh
# DESC: 발행 전 죽은 링크 검사. Hugo가 경고하지 않는 두 사각지대를 본다.
#       ① 글끼리의 내부 링크 href="/…/"가 실제 페이지로 가는가 → 오타다, 막는다 (exit 1)
#       ② [[용어]]가 glossary에 있는가 → 막지 않는다, 목록만 남긴다 (다음에 쓸 용어)
# 사용: sh scripts/check-links.sh            (0=내부 링크 통과, 1=죽은 내부 링크)
#       sh scripts/check-links.sh --strict   (없는 용어도 실패로)
set -e
cd "$(dirname "$0")/.."

strict=0
[ "$1" = "--strict" ] && strict=1

out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
hugo --destination "$out" --quiet

# ① 내부 링크 — 빌드 HTML의 href="/…/"를 실제 파일과 대조.
#    JS 안의 템플릿 문자열('/posts/' + …)은 링크가 아니라 제외한다.
grep -rhoE 'href="/[^"#?]*"' --include='*.html' "$out" \
  | sed 's/href="//; s/"$//' | sort -u | grep -v 'escHtml' > "$out/.hrefs" || true
: > "$out/.dead"
while read -r p; do
  [ -e "$out$p" ] && continue
  [ -e "$out${p}index.html" ] && continue
  echo "$p" >> "$out/.dead"
done < "$out/.hrefs"
total=$(wc -l < "$out/.hrefs" | tr -d ' ')

# ② [[용어]] — 소스에서 코드펜스 밖의 것만 센다. 펜스 안은 위키링크 JS가 건너뛴다.
ls content/glossary/*.md | sed 's|.*/||; s|\.md$||' | grep -v '^_index$' \
  | tr 'A-Z' 'a-z' | sort -u > "$out/.have"
awk '
  /^```/ { fence = !fence; next }
  fence  { next }
  {
    line = $0
    while (match(line, /\[\[[^]|#]+/)) {
      print substr(line, RSTART + 2, RLENGTH - 2)
      line = substr(line, RSTART + RLENGTH)
    }
  }
' content/posts/*.md content/glossary/*.md content/wiki/*.md 2>/dev/null \
  | sed 's/^ *//; s/ *$//; s/  */-/g' | tr 'A-Z' 'a-z' | sort -u > "$out/.want"
comm -23 "$out/.want" "$out/.have" > "$out/.missing"

status=0
if [ -s "$out/.dead" ]; then
  echo "죽은 내부 링크 — 발행 중단:" >&2
  sed 's/^/  /' "$out/.dead" >&2
  echo "  (가리키는 slug가 실제로 있는지 확인할 것. Hugo는 경고하지 않는다)" >&2
  status=1
else
  echo "내부 링크 이상 없음 (${total}개)"
fi

if [ -s "$out/.missing" ]; then
  echo "glossary에 없는 용어 — 다음에 쓸 목록:"
  sed 's/^/  [[/; s/$/]]/' "$out/.missing"
  echo "  (링크는 404로 간다. 항목을 쓰거나 있는 이름으로 맞출 것 — 2026-09-26엔 10편을 썼다)"
  [ "$strict" = 1 ] && status=1
else
  echo "없는 용어 없음 (glossary $(wc -l < "$out/.have" | tr -d ' ')종)"
fi

exit $status
