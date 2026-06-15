from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
TEMP_DEPS_DIR = ROOT_DIR / "tmp" / "pyhwpxdeps"

if str(TEMP_DEPS_DIR) not in sys.path:
    sys.path.insert(0, str(TEMP_DEPS_DIR))

from hwpx import HwpxDocument  # type: ignore


@dataclass(frozen=True)
class ScreenshotSpec:
    title: str
    filename: str
    width_mm: float = 85.0


SCREENSHOT_GROUPS: list[tuple[str, list[ScreenshotSpec]]] = [
    (
        "1. 로그인 및 회원가입",
        [
            ScreenshotSpec("로그인 화면", "KakaoTalk_20260603_210211259_20.jpg"),
            ScreenshotSpec("회원가입 화면", "KakaoTalk_20260603_210211259_21.jpg"),
        ],
    ),
    (
        "2. 홈 화면",
        [
            ScreenshotSpec("홈 대시보드 기본 상태", "KakaoTalk_20260603_210211259.jpg"),
            ScreenshotSpec("홈 대시보드 진행 기록 반영 상태", "KakaoTalk_20260603_210211259_01.jpg"),
            ScreenshotSpec("홈 화면 즐겨찾기 카드 영역", "KakaoTalk_20260603_210211259_03.jpg"),
        ],
    ),
    (
        "3. 클래스 탐색 및 상세",
        [
            ScreenshotSpec("클래스 상세 모달 상단", "KakaoTalk_20260603_210211259_02.jpg"),
            ScreenshotSpec("클래스 상세 모달 하단", "KakaoTalk_20260603_210211259_04.jpg"),
            ScreenshotSpec("클래스 탐색 메인 화면", "KakaoTalk_20260603_210211259_07.jpg"),
            ScreenshotSpec("전체 클래스 목록 화면", "KakaoTalk_20260603_210211259_08.jpg"),
        ],
    ),
    (
        "4. 실시간 연습",
        [
            ScreenshotSpec("실시간 연습 대시보드", "KakaoTalk_20260603_210211259_05.jpg"),
            ScreenshotSpec("전체 화면 연습 장면", "KakaoTalk_20260603_210211259_06.jpg", width_mm=150.0),
        ],
    ),
    (
        "5. 식단 촬영 및 분석",
        [
            ScreenshotSpec("식단 촬영 초기 화면", "KakaoTalk_20260603_210211259_09.jpg"),
            ScreenshotSpec("식단 사진 준비 완료 상태", "KakaoTalk_20260603_210211259_10.jpg"),
        ],
    ),
    (
        "6. 기록 화면",
        [
            ScreenshotSpec("월간 기록 요약 상단", "KakaoTalk_20260603_210211259_11.jpg"),
            ScreenshotSpec("월간 기록 세부 카드", "KakaoTalk_20260603_210211259_12.jpg"),
            ScreenshotSpec("월간 캘린더 화면", "KakaoTalk_20260603_210211259_13.jpg"),
            ScreenshotSpec("선택 날짜 기록 상세", "KakaoTalk_20260603_210211259_14.jpg"),
            ScreenshotSpec("체중 흐름 메인 화면", "KakaoTalk_20260603_210211259_15.jpg"),
            ScreenshotSpec("체중 흐름 세부 카드", "KakaoTalk_20260603_210211259_16.jpg"),
            ScreenshotSpec("체중 인사이트 및 월별 기록", "KakaoTalk_20260603_210211259_17.jpg"),
        ],
    ),
    (
        "7. 프로필 화면",
        [
            ScreenshotSpec("프로필 메인 화면", "KakaoTalk_20260603_210211259_18.jpg"),
            ScreenshotSpec("프로필 업적 및 계정 영역", "KakaoTalk_20260603_210211259_19.jpg"),
        ],
    ),
]


def add_paragraph(document: HwpxDocument, text: str) -> None:
    document.add_paragraph(text, section_index=0)


def append_screenshot_section(document: HwpxDocument, image_dir: Path) -> None:
    add_paragraph(document, "")
    add_paragraph(document, "앱 실행 화면")
    add_paragraph(
        document,
        "아래 화면은 2026년 6월 3일 기준 실제 앱 실행 캡처를 기준으로 정리한 결과입니다.",
    )

    for group_title, screenshots in SCREENSHOT_GROUPS:
        add_paragraph(document, "")
        add_paragraph(document, group_title)

        for screenshot in screenshots:
            image_path = image_dir / screenshot.filename
            if not image_path.exists():
                raise FileNotFoundError(f"스크린샷 파일을 찾을 수 없습니다: {image_path}")

            document.add_picture(
                image_path.read_bytes(),
                image_path.suffix.lstrip("."),
                width_mm=screenshot.width_mm,
                align="CENTER",
                section_index=0,
            )
            add_paragraph(document, screenshot.title)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="기존 모바일 UI HWPX 보고서에 앱 실행 화면을 추가합니다."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=ROOT_DIR / "docs" / "mobile-ui-report.hwpx",
        help="업데이트할 HWPX 파일 경로",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="저장할 HWPX 파일 경로. 기본값은 입력 파일 덮어쓰기",
    )
    parser.add_argument(
        "--image-dir",
        type=Path,
        default=Path(r"C:\Users\USER-PC\Documents\카카오톡 받은 파일"),
        help="스크린샷 이미지가 들어있는 폴더 경로",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    output_path = args.output.resolve() if args.output else input_path
    image_dir = args.image_dir.resolve()

    if not input_path.exists():
        raise FileNotFoundError(f"HWPX 파일을 찾을 수 없습니다: {input_path}")
    if not image_dir.exists():
        raise FileNotFoundError(f"이미지 폴더를 찾을 수 없습니다: {image_dir}")

    document = HwpxDocument.open(input_path)
    try:
        append_screenshot_section(document, image_dir)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        document.save_to_path(output_path)
    finally:
        document.close()

    print(f"updated: {output_path}")


if __name__ == "__main__":
    main()
