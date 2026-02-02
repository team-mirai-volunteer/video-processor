export interface DictionaryEntry {
  correct: string;
  category: 'person' | 'organization' | 'service' | 'political_term';
  description: string;
  wrongPatterns: string[];
}

export const properNounDictionary: DictionaryEntry[] = [
  {
    correct: 'チームみらい',
    category: 'organization',
    description: '政党名',
    wrongPatterns: ['チーム未来', 'チーム見来', 'チームミライ'],
  },
  {
    correct: '安野たかひろ',
    category: 'person',
    description: 'チームみらい党首',
    wrongPatterns: ['安野高広', 'あんの高広', '安野孝広', '安野隆広'],
  },
  {
    correct: '党首',
    category: 'political_term',
    description: '政党の代表者（政治の文脈で）',
    wrongPatterns: ['投手', '闘手'],
  },
  {
    correct: '稲原むねよし',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['稲原宗義', '稲原棟義', '稲原宗良'],
  },
  {
    correct: '武藤かず子',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['武藤和子', '武藤一子', '武藤かずこ'],
  },
  {
    correct: '河合みちお',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['河合道夫', '河合通夫', '河合美智雄'],
  },
  {
    correct: '小林しゅうへい',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['小林周平', '小林秀平', '小林修平'],
  },
  {
    correct: '山田えり',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['山田絵理', '山田恵里', '山田英里'],
  },
  {
    correct: 'うさみ登',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['宇佐美登', 'うさみのぼる', '宇佐見登'],
  },
  {
    correct: '高山さとし',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['高山聡', '高山智', '高山悟'],
  },
  {
    correct: '土橋あきひろ',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['土橋明広', '土橋昭広', '土橋章広'],
  },
  {
    correct: 'みねしま侑也',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['峰島侑也', '峯島侑也', '嶺島侑也'],
  },
  {
    correct: '須田えいたろう',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['須田栄太郎', '須田英太郎', '須田瑛太郎'],
  },
  {
    correct: '酒井ゆうすけ',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['酒井雄介', '酒井裕介', '酒井祐介'],
  },
  {
    correct: '堀場さち子',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['堀場幸子', '堀場佐智子', '堀場祥子'],
  },
  {
    correct: '山本たけよし',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['山本武義', '山本剛義', '山本健義'],
  },
  {
    correct: '古川あおい',
    category: 'person',
    description: 'チームみらい立候補者',
    wrongPatterns: ['古川葵', '古川碧', '古川蒼'],
  },
  {
    correct: 'みらい議会',
    category: 'service',
    description: 'チームみらいのサービス名',
    wrongPatterns: ['未来議会', 'ミライ議会', 'みらい議かい'],
  },
  {
    correct: 'みらいまる見え政治資金',
    category: 'service',
    description: 'チームみらいのサービス名',
    wrongPatterns: ['未来まる見え政治資金', 'ミライまる見え政治資金', 'みらい丸見え政治資金'],
  },
];
