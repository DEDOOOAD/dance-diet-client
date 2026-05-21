import { colors } from '@/constants/theme';

export type DanceClass = {
  id: string;
  genre: string;
  title: string;
  subtitle: string;
  instructor: string;
  level: '입문' | '초급' | '중급' | '고급';
  duration: string;
  kcal: number;
  students: number;
  icon: string;
  color: string;
  rating: string;
  tags: string[];
  goals: string[];
  steps: string[];
};

export const genreFilters = ['전체', 'K-POP', 'HIP-HOP', 'LATIN', 'JAZZ', 'HOUSE'] as const;

export const danceClasses: DanceClass[] = [
  {
    id: 'kpop-hype',
    genre: 'K-POP',
    title: '아이돌 포인트 안무',
    subtitle: '카메라에 잘 보이는 포인트 동작을 중심으로 익혀요.',
    instructor: '미나 리',
    level: '중급',
    duration: '45분',
    kcal: 320,
    students: 2841,
    icon: 'sparkles',
    color: colors.accent,
    rating: '4.9',
    tags: ['인기', '퍼포먼스', '전신 사용'],
    goals: ['팔 라인을 깔끔하게 만들기', '후렴 타이밍 정확히 맞추기', '무대 자신감 끌어올리기'],
    steps: [
      '어깨, 골반, 무릎을 중심으로 가볍게 아이솔레이션 워밍업을 해요.',
      '후렴 안무를 8카운트씩 나눠 천천히 반복해요.',
      '마지막에는 표정과 라인을 더 크게 써서 완성도를 높여요.',
    ],
  },
  {
    id: 'hiphop-groove',
    genre: 'HIP-HOP',
    title: '바운스 그루브 세션',
    subtitle: '상체는 편안하게, 스텝은 묵직하게, 히트는 깔끔하게 가져가요.',
    instructor: 'DJ Mochi',
    level: '초급',
    duration: '30분',
    kcal: 280,
    students: 1594,
    icon: 'flash',
    color: colors.purple,
    rating: '4.8',
    tags: ['그루브', '리듬감', '유산소'],
    goals: ['자연스러운 바운스 만들기', '비트 포인트 정확히 찍기', '프리스타일 자신감 올리기'],
    steps: [
      '1박과 3박에 바운스를 주는 타이밍부터 익혀요.',
      '가벼운 발동작 위에 가슴과 어깨 그루브를 더해요.',
      '짧은 콤보를 완성한 뒤 음악 속도에 맞춰 반복해요.',
    ],
  },
  {
    id: 'latin-flow',
    genre: 'LATIN',
    title: '살사 바디 플로우',
    subtitle: '부드러운 체중 이동과 경쾌한 무드로 흐름을 살려요.',
    instructor: '소피아 루나',
    level: '입문',
    duration: '40분',
    kcal: 250,
    students: 987,
    icon: 'sunny',
    color: colors.teal,
    rating: '4.7',
    tags: ['플로우', '풋워크', '밸런스'],
    goals: ['체중 이동 감각 익히기', '가슴을 열고 자세 세우기', '가볍고 빠른 스텝 유지하기'],
    steps: [
      '앞뒤로 이동하는 기본 살사 스텝 타이밍을 연습해요.',
      '코어를 잡은 상태로 팔 스타일링을 추가해요.',
      '턴 준비 동작과 마무리 포즈까지 연결해서 춰봐요.',
    ],
  },
  {
    id: 'jazz-lines',
    genre: 'JAZZ',
    title: '샤프 재즈 라인',
    subtitle: '강한 자세와 긴 라인, 음악 포인트를 또렷하게 살려요.',
    instructor: '박수',
    level: '입문',
    duration: '25분',
    kcal: 180,
    students: 765,
    icon: 'star',
    color: '#F59E0B',
    rating: '4.6',
    tags: ['자세', '테크닉', '뮤지컬리티'],
    goals: ['몸 라인을 길게 쓰기', '강약 포인트 분명하게 표현하기', '턴 밸런스 안정적으로 잡기'],
    steps: [
      '플리에와 텐듀, 척추 정렬로 기본기를 풀어줘요.',
      '코어를 유지한 채 킥과 방향 전환을 연습해요.',
      '호흡을 맞추며 마지막 포즈까지 깔끔하게 마무리해요.',
    ],
  },
  {
    id: 'house-footwork',
    genre: 'HOUSE',
    title: '풋워크 러시',
    subtitle: '빠른 발동작과 가벼운 점프, 클럽 무드의 에너지를 담았어요.',
    instructor: '권유',
    level: '고급',
    duration: '50분',
    kcal: 420,
    students: 442,
    icon: 'planet',
    color: '#06B6D4',
    rating: '4.9',
    tags: ['스피드', '지구력', '풋워크'],
    goals: ['바닥을 가볍게 타기', '빠른 템포 제어하기', '지구력 끌어올리기'],
    steps: [
      '힐-토 전환을 느린 속도에서 먼저 정확히 익혀요.',
      '셔플 패턴과 이동 스텝을 자연스럽게 연결해요.',
      '마지막 라운드는 실전 속도로 반복하며 호흡까지 조절해요.',
    ],
  },
  {
    id: 'kpop-beginner',
    genre: 'K-POP',
    title: '쉬운 후렴 스타터',
    subtitle: '매일 연습하기 좋은 가벼운 첫 루틴이에요.',
    instructor: '하나 김',
    level: '초급',
    duration: '35분',
    kcal: 290,
    students: 3210,
    icon: 'heart',
    color: colors.accent2,
    rating: '5.0',
    tags: ['스타터', '암기 쉬움', '데일리 미션'],
    goals: ['후렴 전체 암기하기', '리듬 흔들리지 않기', '자신감 있게 추기'],
    steps: [
      '손카운트를 세며 천천히 안무를 표시해봐요.',
      '가사와 동작을 연결해서 순서를 쉽게 외워요.',
      '마지막 한 번은 촬영하듯 추면서 타이밍과 에너지를 확인해요.',
    ],
  },
];

export const featuredDanceIds = ['kpop-hype', 'hiphop-groove', 'latin-flow'] as const;

export const levelColors: Record<DanceClass['level'], string> = {
  입문: colors.teal,
  초급: '#22C55E',
  중급: '#F59E0B',
  고급: colors.accent,
};
