#!/usr/bin/env bash
set -euo pipefail

WEBHOOK_URL="${WEBHOOK_URL:-https://discord.com/api/webhooks/1503419113056505977/2jdHJf2aOk6oia6FmB0Sn_q3e1HAYoNIHU9CaI7l9se1vVLCj4P0QwXVUy0Ug743G7fE}"
PHOTO_ROOT="${PHOTO_ROOT:-public/fotostime}"
STATE_FILE="${STATE_FILE:-.cache/fotostime-discord-sync.state}"
LOCK_DIR="${LOCK_DIR:-.cache/fotostime-discord-sync.lock}"
MAX_ARCHIVE_BYTES="${MAX_ARCHIVE_BYTES:-7864320}"
MAX_ATTACHMENTS_PER_MESSAGE="${MAX_ATTACHMENTS_PER_MESSAGE:-8}"
WATCH_MODE="${WATCH_MODE:-0}"
WATCH_INTERVAL_SECONDS="${WATCH_INTERVAL_SECONDS:-15}"

if ! command -v zip >/dev/null 2>&1; then
  echo "[erro] comando 'zip' nao encontrado"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[erro] comando 'curl' nao encontrado"
  exit 1
fi

if [ ! -d "${PHOTO_ROOT}" ]; then
  echo "[erro] pasta de fotos nao existe: ${PHOTO_ROOT}"
  exit 1
fi

mkdir -p "$(dirname "${STATE_FILE}")"
mkdir -p ".cache"

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "[info] script ja esta em execucao, encerrando"
  exit 0
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${LOCK_DIR}" "${TMP_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ ! -f "${STATE_FILE}" ]; then
  echo "0" > "${STATE_FILE}"
fi

is_bg_image() {
  local file_name_lower
  file_name_lower="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  case "${file_name_lower}" in
    *-bg-*.png|*-bg-*.jpg|*-bg-*.jpeg|*-bg-*.webp) return 0 ;;
    *) return 1 ;;
  esac
}

process_once() {
  local LAST_TS_RAW LAST_TS NOW_TS RUN_DIR REF_FILE FAILED

  LAST_TS_RAW="$(cat "${STATE_FILE}" 2>/dev/null || echo 0)"
  if [[ ! "${LAST_TS_RAW}" =~ ^[0-9]+$ ]]; then
    LAST_TS_RAW="0"
  fi
  LAST_TS="${LAST_TS_RAW}"
  NOW_TS="$(date +%s)"

  RUN_DIR="${TMP_DIR}/run-${NOW_TS}"
  mkdir -p "${RUN_DIR}"
  REF_FILE="${RUN_DIR}/last-run.ref"
  touch -d "@${LAST_TS}" "${REF_FILE}"

  mapfile -t CHANGED_BG_FILES < <(
    find "${PHOTO_ROOT}" -type f -newer "${REF_FILE}" -print \
      | sed "s#^${PHOTO_ROOT}/##" \
      | awk 'NF > 0' \
      | while IFS= read -r rel; do
          if is_bg_image "${rel}"; then
            echo "${rel}"
          fi
        done \
      | sort -u
  )

  if [ "${#CHANGED_BG_FILES[@]}" -eq 0 ]; then
    echo "${NOW_TS}" > "${STATE_FILE}"
    echo "[info] sem novas fotos bg"
    rm -rf "${RUN_DIR}" >/dev/null 2>&1 || true
    return 0
  fi

  mapfile -t CHANGED_FOLDERS < <(
    printf '%s\n' "${CHANGED_BG_FILES[@]}" \
      | awk -F/ 'NF > 1 {print $1}' \
      | sort -u
  )

  echo "[info] pastas com novas fotos bg: ${CHANGED_FOLDERS[*]}"
  echo "[info] quantidade de arquivos bg novos: ${#CHANGED_BG_FILES[@]}"

  declare -a ARCHIVES=()

  split_kb=$((MAX_ARCHIVE_BYTES / 1024 - 64))
  if [ "${split_kb}" -lt 512 ]; then
    split_kb=512
  fi

  for folder in "${CHANGED_FOLDERS[@]}"; do
    folder_path="${PHOTO_ROOT}/${folder}"
    if [ ! -d "${folder_path}" ]; then
      continue
    fi

    safe_name="$(echo "${folder}" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
    if [ -z "${safe_name}" ]; then
      safe_name="folder"
    fi

    list_file="${RUN_DIR}/${safe_name}.list"
    : > "${list_file}"

    while IFS= read -r rel; do
      case "${rel}" in
        "${folder}/"*) echo "${rel}" >> "${list_file}" ;;
      esac
    done < <(printf '%s\n' "${CHANGED_BG_FILES[@]}")

    if [ ! -s "${list_file}" ]; then
      continue
    fi

    zip_file="${RUN_DIR}/${safe_name}.zip"
    (cd "${PHOTO_ROOT}" && zip -q "${zip_file}" -@ < "${list_file}")

    zip_size="$(stat -c%s "${zip_file}")"
    if [ "${zip_size}" -le "${MAX_ARCHIVE_BYTES}" ]; then
      ARCHIVES+=("${zip_file}")
      continue
    fi

    rm -f "${zip_file}"
    split_base="${RUN_DIR}/${safe_name}-part.zip"
    (cd "${PHOTO_ROOT}" && zip -q -s "${split_kb}k" "${split_base}" -@ < "${list_file}")

    while IFS= read -r part; do
      ARCHIVES+=("${part}")
    done < <(find "${RUN_DIR}" -maxdepth 1 -type f \( -name "${safe_name}-part.z*" -o -name "${safe_name}-part.zip" \) | sort)
  done

  if [ "${#ARCHIVES[@]}" -eq 0 ]; then
    echo "[info] nenhuma imagem bg valida para envio"
    echo "${NOW_TS}" > "${STATE_FILE}"
    rm -rf "${RUN_DIR}" >/dev/null 2>&1 || true
    return 0
  fi

  send_batch() {
    local -a files=("$@")
    local content="[fotostime-sync] novas imagens bg detectadas em ${#CHANGED_FOLDERS[@]} pasta(s). Enviando ${#files[@]} zip(s)."

    local -a curl_cmd=(curl -sS -o "${RUN_DIR}/webhook-response.txt" -w "%{http_code}" -X POST "${WEBHOOK_URL}" -F "content=${content}")

    local i=0
    for f in "${files[@]}"; do
      curl_cmd+=( -F "files[${i}]=@${f}" )
      i=$((i + 1))
    done

    local http_code
    http_code="$("${curl_cmd[@]}")"

    if [[ "${http_code}" != 2* ]]; then
      echo "[erro] webhook retornou HTTP ${http_code}"
      echo "[erro] resposta:"
      cat "${RUN_DIR}/webhook-response.txt" || true
      return 1
    fi

    return 0
  }

  FAILED=0
  BATCH=()

  for archive in "${ARCHIVES[@]}"; do
    archive_size="$(stat -c%s "${archive}")"
    if [ "${archive_size}" -gt "${MAX_ARCHIVE_BYTES}" ]; then
      echo "[erro] arquivo ainda acima do limite: ${archive} (${archive_size} bytes)"
      FAILED=1
      continue
    fi

    BATCH+=("${archive}")

    if [ "${#BATCH[@]}" -ge "${MAX_ATTACHMENTS_PER_MESSAGE}" ]; then
      if ! send_batch "${BATCH[@]}"; then
        FAILED=1
      fi
      BATCH=()
    fi
  done

  if [ "${#BATCH[@]}" -gt 0 ]; then
    if ! send_batch "${BATCH[@]}"; then
      FAILED=1
    fi
  fi

  if [ "${FAILED}" -eq 0 ]; then
    echo "${NOW_TS}" > "${STATE_FILE}"
    echo "[ok] envio concluido"
  else
    echo "[warn] houve falhas no envio; estado nao foi atualizado para tentar novamente na proxima execucao"
    return 1
  fi

  rm -rf "${RUN_DIR}" >/dev/null 2>&1 || true
  return 0
}

if [ "${WATCH_MODE}" = "1" ]; then
  echo "[watch] monitoramento ativo em ${PHOTO_ROOT} (intervalo: ${WATCH_INTERVAL_SECONDS}s)"
  while true; do
    process_once || true
    sleep "${WATCH_INTERVAL_SECONDS}"
  done
else
  process_once
fi
