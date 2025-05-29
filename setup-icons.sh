#!/bin/bash

# 프로젝트 루트 및 public 디렉토리에 아이콘 생성
mkdir -p public

# 간단한 더미 아이콘 파일 생성 (1x1 투명 PNG)
ICON_SIZES=("16" "32" "48" "128")
DUMMY_PNG_HEX="89504e470d0a1a0a0000000d4948445200000001000000010100000000376ef9240000001049444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082"

echo "🖼️ 더미 아이콘 파일 생성 중..."
for SIZE in "${ICON_SIZES[@]}"; do
  echo "📝 icon-${SIZE}.png 생성 중..."
  echo $DUMMY_PNG_HEX | xxd -r -p > "icon-${SIZE}.png"
  cp "icon-${SIZE}.png" "public/icon-${SIZE}.png"
done

echo "✅ 더미 아이콘 생성 완료!"
