// Tour stop photo registry. Generated from data/reference_photos/manifest.csv (source=user).
// Regenerate with the association script after adding photos; unreferenced stops fall back to placeholders.
export interface TourPhoto {
  src: string;
  caption: string;
  creator?: string | null;
  license?: string | null;
  sourceUrl?: string | null;
  placeholder?: boolean;
}

const PHOTOS: Record<string, TourPhoto> = {
  'beiyangyuan-datong-center': { src: '/assets/campus/photos/beiyangyuan-datong-center-1.jpg', caption: '大通学生中心', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-earthquake-facility': { src: '/assets/campus/photos/beiyangyuan-earthquake-facility-1.jpg', caption: '国家大型地震工程模拟研究设施', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-east-gate': { src: '/assets/campus/photos/beiyangyuan-east-gate-1.jpg', caption: '北洋园校区东门', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-gaokao-wall': { src: '/assets/campus/photos/beiyangyuan-gaokao-wall-1.jpg', caption: '恢复高考纪念墙', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-gym': { src: '/assets/campus/photos/beiyangyuan-gym-1.jpg', caption: '综合体育馆', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-main-building': { src: '/assets/campus/photos/beiyangyuan-main-building-1.jpg', caption: '北洋园校区主楼', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-memorial-pavilion': { src: '/assets/campus/photos/beiyangyuan-memorial-pavilion-1.jpg', caption: '北洋纪念亭', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-motto-stone': { src: '/assets/campus/photos/beiyangyuan-motto-stone-1.jpg', caption: '实事求是校训石', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-qiushi-hall': { src: '/assets/campus/photos/beiyangyuan-qiushi-hall-1.jpg', caption: '求实会堂', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-sanwen-bridge': { src: '/assets/campus/photos/beiyangyuan-sanwen-bridge-1.jpg', caption: '三问桥', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-shangxian-stone': { src: '/assets/campus/photos/beiyangyuan-shangxian-stone-1.jpg', caption: '尚贤石', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-suzhou-pavilion': { src: '/assets/campus/photos/beiyangyuan-suzhou-pavilion-1.jpg', caption: '苏州亭', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-tju-star': { src: '/assets/campus/photos/beiyangyuan-tju-star-1.jpg', caption: '天津大学星', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xingsun-building': { src: '/assets/campus/photos/beiyangyuan-xingsun-building-1.jpg', caption: '杏荪楼', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xuanhuai-square': { src: '/assets/campus/photos/beiyangyuan-xuanhuai-square-1.jpg', caption: '宣怀广场', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xue-1-dining': { src: '/assets/campus/photos/beiyangyuan-xue-1-dining-1.jpg', caption: '学一食堂（梅园餐厅）', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xue-2-dining': { src: '/assets/campus/photos/beiyangyuan-xue-2-dining-1.jpg', caption: '学二食堂（兰园餐厅）', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xue-3-dining': { src: '/assets/campus/photos/beiyangyuan-xue-3-dining-1.jpg', caption: '学三食堂（棠园餐厅）', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xue-4-dining': { src: '/assets/campus/photos/beiyangyuan-xue-4-dining-1.jpg', caption: '学四食堂（竹园餐厅）', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xue-5-dining': { src: '/assets/campus/photos/beiyangyuan-xue-5-dining-1.jpg', caption: '学五食堂（桃园餐厅）', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-xue-6-dining': { src: '/assets/campus/photos/beiyangyuan-xue-6-dining-1.jpg', caption: '学六食堂（菊园餐厅）', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'beiyangyuan-zhengdong-library': { src: '/assets/campus/photos/beiyangyuan-zhengdong-library-1.jpg', caption: '郑东图书馆', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
  'weijinlu-newton-tree': { src: '/assets/campus/photos/weijinlu-newton-tree-1.jpg', caption: '牛顿苹果树', creator: '用户提供', license: '本机导览使用', sourceUrl: null },
};

function placeholderImage(title: string): string {
  const safe = title.replace(/[<>&"']/g, '').slice(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">`
    + `<rect width="640" height="400" fill="#e9f0ea"/>`
    + `<rect x="24" y="24" width="592" height="352" rx="16" fill="#f7faf7" stroke="#c9d8cc" stroke-dasharray="10 8"/>`
    + `<circle cx="320" cy="168" r="46" fill="none" stroke="#9db8a6" stroke-width="6"/>`
    + `<path d="M298 180l16-22 14 16 12-14 20 26z" fill="#9db8a6"/>`
    + `<circle cx="306" cy="152" r="7" fill="#9db8a6"/>`
    + `<text x="320" y="258" text-anchor="middle" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="30" fill="#41604f">${safe}</text>`
    + `<text x="320" y="300" text-anchor="middle" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="18" fill="#7d9486">实景图待补充 · 点击查看预留位</text>`
    + `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function tourPhotoFor(poiId: string, title: string): TourPhoto {
  const photo = PHOTOS[poiId];
  if (photo && photo.src) return photo;
  return { src: placeholderImage(title), caption: title, placeholder: true };
}

export function registeredPhotos(): Array<{ poiId: string; src: string; caption: string }> {
  return Object.entries(PHOTOS)
    .filter(([, photo]) => Boolean(photo.src))
    .map(([poiId, photo]) => ({ poiId, src: photo.src, caption: photo.caption }));
}
