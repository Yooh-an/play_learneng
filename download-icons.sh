#!/bin/bash

# 임시 아이콘 이미지 다운로드 스크립트
ICON_SIZES=("16" "32" "48" "128")
BASE_URL="https://placehold.co"

echo "🖼️ Play LearnEng 아이콘 다운로드 중..."

# public 디렉토리가 없으면 생성
mkdir -p public

for SIZE in "${ICON_SIZES[@]}"; do
  echo "📥 ${SIZE}x${SIZE} 아이콘 다운로드 중..."
  
  # 여러 URL 형식을 시도하여 성공할 때까지 반복
  URL_FORMATS=(
    "${BASE_URL}/${SIZE}x${SIZE}/5271ff/ffffff.png?text=PLE"
    "${BASE_URL}/${SIZE}x${SIZE}.png?text=PLE&background=5271ff&color=ffffff"
    "${BASE_URL}/${SIZE}x${SIZE}.png?text=PLE"
    "${BASE_URL}/${SIZE}x${SIZE}/5271ff/ffffff?text=PLE"
  )
  
  SUCCESS=false
  for URL in "${URL_FORMATS[@]}"; do
    echo "   시도 중: $URL"
    if curl -s --fail "$URL" -o "public/icon-${SIZE}.png"; then
      # 파일이 실제로 생성되고 크기가 0보다 큰지 확인
      if [[ -f "public/icon-${SIZE}.png" && -s "public/icon-${SIZE}.png" ]]; then
        echo "   ✅ 성공: ${SIZE}x${SIZE} 아이콘 다운로드 완료"
        SUCCESS=true
        break
      else
        echo "   ❌ 실패: 파일이 비어있음"
        rm -f "public/icon-${SIZE}.png"
      fi
    else
      echo "   ❌ 실패: 다운로드 오류"
    fi
  done
  
  if [[ "$SUCCESS" != true ]]; then
    echo "   ⚠️  경고: ${SIZE}x${SIZE} 아이콘 다운로드 실패"
  fi
done

echo "✅ 아이콘 다운로드 프로세스 완료!"

# 다운로드된 파일들 확인
echo ""
echo "📋 다운로드된 아이콘 파일:"
ls -la public/icon-*.png 2>/dev/null || echo "다운로드된 아이콘이 없습니다."
