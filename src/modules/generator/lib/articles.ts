import type { IconName } from '@/common/ui';

export type Run =
  | string
  | { bold: string }
  | { italic: string }
  | { sup: string }
  | { sub: string }
  | { code: string };

export interface Factor {
  icon: IconName;
  title: string;
  text: string;
}

export interface Article {
  id: ArticleId;
  label: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  kicker: string;
  title: string;
  lead: string;
  meta: string;
  factors: Factor[];
  columnsHeading: string;
  columns: Run[][];
  quote: { text: string; cite: string };
  listHeading: string;
  list: Run[][];
  tableHeading: string;
  tableHead: [string, string];
  tableRows: [string, string][];
  glyphsHeading: string;
  glyphs: string;
  footer: string;
}

export const ARTICLE_IDS = ['en', 'ru', 'ar', 'ja'] as const;
export type ArticleId = (typeof ARTICLE_IDS)[number];

const en: Article = {
  id: 'en',
  label: 'English',
  lang: 'en',
  dir: 'ltr',
  kicker: 'Field notes · №7 · Typography & performance',
  title: 'Why the page jumps when a font loads',
  lead: 'A web font arrives a moment after the text is first painted. Until then the browser shows a fallback, and when the real font takes over, every line can change its width and every block its height.',
  meta: 'By the fontstay team · 12 min read · © 2026 · ½ of the story is in the metrics',
  factors: [
    {
      icon: 'text-width',
      title: 'Glyph width',
      text: 'Every typeface sets its letters at a different width, so the same sentence wraps at a different word.',
    },
    {
      icon: 'text-height',
      title: 'Line height',
      text: 'The font’s own ascent and descent and the line-height rule decide how much room a line takes.',
    },
    {
      icon: 'arrows-up-down',
      title: 'Vertical metrics',
      text: 'Ascent, descent and line gap live in the font file; a substitute with other numbers shifts the baseline.',
    },
    {
      icon: 'language',
      title: 'Scripts and fallbacks',
      text: 'Characters missing from the web font come from another family, which can make one line taller than its neighbours.',
    },
  ],
  columnsHeading: 'What moves, and why',
  columns: [
    [
      'Take a plain paragraph. In the ',
      { italic: 'fallback' },
      ' font it fills four lines; in the ',
      { bold: 'web font' },
      ' the same words need five. Everything below slides down by one line: that is a ',
      { bold: 'layout shift' },
      '.',
    ],
    [
      'Width is only half of the story. Each font carries its own ',
      { italic: 'ascent' },
      ', ',
      { italic: 'descent' },
      ' and ',
      { italic: 'line gap' },
      '. With ',
      { code: 'line-height: normal' },
      ' the browser builds the line box from them, so another font means another height even at the same size.',
    ],
    [
      'Inline elements add their own pressure: a ',
      { bold: 'bold' },
      ' run, an ',
      { italic: 'italic' },
      ' phrase, a superscript',
      { sup: '2' },
      ' or a symbol such as ™ may come from another face and stretch the line it sits on.',
    ],
    [
      'Headings are the most visible victims. A large title that jumps by a few pixels drags the whole article with it, which is why headings and body text deserve separate fallbacks.',
    ],
    [
      'Text can also be ',
      { italic: 're-balanced' },
      '. Modern ',
      { code: 'text-wrap: balance' },
      ' and ',
      { code: 'text-wrap: pretty' },
      ' change where lines break, so test with and without them.',
    ],
    [
      'The cure is boring and effective: scale the fallback with ',
      { code: 'size-adjust' },
      ' and give it the web font’s vertical metrics with ',
      { code: 'ascent-override' },
      ', ',
      { code: 'descent-override' },
      ' and ',
      { code: 'line-gap-override' },
      '.',
    ],
  ],
  quote: {
    text: 'The best layout shift is the one nobody notices.',
    cite: '— a rule of thumb',
  },
  listHeading: 'A checklist for the next release',
  list: [
    ['Pick the ', { bold: 'fallback' }, ' per system, not one for everybody.'],
    [
      'Compare ',
      { italic: 'regular' },
      ', ',
      { bold: 'bold' },
      ' and ',
      { italic: 'italic' },
      ' faces separately.',
    ],
    ['Test long and short lines, and with ', { code: 'text-wrap' }, ' on.'],
    ['Check scripts you do not read: Arabic, Japanese, Cyrillic.'],
  ],
  tableHeading: 'Where a line gets its height',
  tableHead: ['Cause', 'Effect'],
  tableRows: [
    ['Font size', 'Scales every metric'],
    ['line-height', 'Overrides the font’s own metrics'],
    ['Ascent and descent', 'Set the content area of the line'],
    ['Fallback glyphs', 'Can raise a single line'],
    ['Superscript and subscript', 'Push the line box up or down'],
  ],
  glyphsHeading: 'Special characters',
  glyphs:
    '& © ® ™ § ¶ † ‡ • … – — « » “ ” ‘ ’ № € £ ¥ ¢ % ‰ ° ± × ÷ ≈ ≠ ≤ ≥ ∞ √ π → ← ↑ ↓ ½ ¼ ¾ ¹ ² ³ ℃ ﬁ ﬂ',
  footer:
    'Set in two typefaces: the headings and the text come from different families. Switch the view above to compare the web font with its adjusted fallback.',
};

const ru: Article = {
  id: 'ru',
  label: 'Русский',
  lang: 'ru',
  dir: 'ltr',
  kicker: 'Заметки · №7 · Типографика и скорость',
  title: 'Почему страница прыгает при загрузке шрифта',
  lead: 'Веб-шрифт приходит чуть позже, чем текст впервые рисуется. До этого браузер показывает запасной шрифт, а когда настоящий вступает в силу, каждая строка может поменять ширину, а каждый блок — высоту.',
  meta: 'Команда fontstay · 12 минут · © 2026 · ½ истории спрятана в метриках',
  factors: [
    {
      icon: 'text-width',
      title: 'Ширина символов',
      text: 'У каждой гарнитуры буквы шире или уже, поэтому одно и то же предложение переносится на другом слове.',
    },
    {
      icon: 'text-height',
      title: 'Высота строки',
      text: 'Подъём и спуск самого шрифта и правило line-height решают, сколько места занимает строка.',
    },
    {
      icon: 'arrows-up-down',
      title: 'Вертикальные метрики',
      text: 'Подъём, спуск и межстрочный зазор записаны в файле шрифта; замена с другими числами сдвигает базовую линию.',
    },
    {
      icon: 'language',
      title: 'Письменности и замены',
      text: 'Символы, которых нет в веб-шрифте, берутся из другой семьи, и одна строка может стать выше соседних.',
    },
  ],
  columnsHeading: 'Что сдвигается и почему',
  columns: [
    [
      'Возьмём обычный абзац. В ',
      { italic: 'запасном' },
      ' шрифте он занимает четыре строки, в ',
      { bold: 'веб-шрифте' },
      ' те же слова требуют пяти. Всё ниже сползает на строку — это ',
      { bold: 'сдвиг вёрстки' },
      '.',
    ],
    [
      'Ширина — лишь половина дела. У каждого шрифта свои ',
      { italic: 'ascent' },
      ', ',
      { italic: 'descent' },
      ' и ',
      { italic: 'line gap' },
      '. При ',
      { code: 'line-height: normal' },
      ' браузер строит из них строку, поэтому другой шрифт даёт другую высоту при том же размере.',
    ],
    [
      'Встроенные элементы добавляют своё: ',
      { bold: 'жирный' },
      ' фрагмент, ',
      { italic: 'курсивная' },
      ' фраза, верхний индекс',
      { sup: '2' },
      ' или символ вроде ™ могут прийти из другой гарнитуры и растянуть строку.',
    ],
    [
      'Заголовки страдают заметнее всего. Крупный заголовок, прыгнувший на пару пикселей, тянет за собой всю статью, поэтому для заголовков и основного текста нужны отдельные запасные шрифты.',
    ],
    [
      'Текст ещё и ',
      { italic: 'перебалансируется' },
      '. Современные ',
      { code: 'text-wrap: balance' },
      ' и ',
      { code: 'text-wrap: pretty' },
      ' меняют места переносов — проверяйте с ними и без них.',
    ],
    [
      'Лекарство скучное, но работает: масштабируйте запасной шрифт через ',
      { code: 'size-adjust' },
      ' и задайте ему метрики веб-шрифта через ',
      { code: 'ascent-override' },
      ', ',
      { code: 'descent-override' },
      ' и ',
      { code: 'line-gap-override' },
      '.',
    ],
  ],
  quote: {
    text: 'Лучший сдвиг вёрстки — тот, которого никто не заметил.',
    cite: '— практическое правило',
  },
  listHeading: 'Чек-лист перед релизом',
  list: [
    ['Подбирайте ', { bold: 'запасной шрифт' }, ' под каждую систему, а не один на всех.'],
    [
      'Сравнивайте ',
      { italic: 'обычное' },
      ', ',
      { bold: 'жирное' },
      ' и ',
      { italic: 'курсивное' },
      ' начертания отдельно.',
    ],
    ['Проверяйте длинные и короткие строки, а также с включённым ', { code: 'text-wrap' }, '.'],
    ['Смотрите письменности, которых вы не читаете: арабскую, японскую, кириллицу.'],
  ],
  tableHeading: 'Откуда у строки берётся высота',
  tableHead: ['Причина', 'Следствие'],
  tableRows: [
    ['Размер шрифта', 'Масштабирует все метрики'],
    ['line-height', 'Перекрывает метрики самого шрифта'],
    ['Подъём и спуск', 'Задают область содержимого строки'],
    ['Символы из запасного шрифта', 'Могут поднять одну строку'],
    ['Верхний и нижний индексы', 'Сдвигают строку вверх или вниз'],
  ],
  glyphsHeading: 'Специальные символы',
  glyphs:
    '& © ® ™ § ¶ † ‡ • … – — « » „ “ ‘ ’ № € £ ¥ ¢ % ‰ ° ± × ÷ ≈ ≠ ≤ ≥ ∞ √ π → ← ↑ ↓ ½ ¼ ¾ ¹ ² ³ ℃ ё Ё',
  footer:
    'Набрано двумя гарнитурами: заголовки и текст из разных семей. Переключайте вид выше, чтобы сравнить веб-шрифт с подогнанным запасным.',
};

const ar: Article = {
  id: 'ar',
  label: 'العربية',
  lang: 'ar',
  dir: 'rtl',
  kicker: 'ملاحظات ميدانية · العدد ٧ · الطباعة والأداء',
  title: 'لماذا تقفز الصفحة عند تحميل الخط',
  lead: 'يصل خط الويب بعد لحظة من رسم النص لأول مرة. وحتى ذلك الحين يعرض المتصفح خطًا احتياطيًا، وعندما يحلّ الخط الحقيقي محله قد يتغيّر عرض كل سطر وارتفاع كل كتلة.',
  meta: 'فريق fontstay · ١٢ دقيقة قراءة · © ٢٠٢٦ · نصف الحكاية في المقاييس',
  factors: [
    {
      icon: 'text-width',
      title: 'عرض الحروف',
      text: 'لكل خط عرض مختلف للحروف، لذلك تُلتفّ الجملة نفسها عند كلمة مختلفة.',
    },
    {
      icon: 'text-height',
      title: 'ارتفاع السطر',
      text: 'يحدد صعود الخط وهبوطه وقاعدة line-height المساحة التي يشغلها السطر.',
    },
    {
      icon: 'arrows-up-down',
      title: 'المقاييس الرأسية',
      text: 'الصعود والهبوط والفراغ بين الأسطر مخزّنة في ملف الخط، وأي بديل بأرقام أخرى يزيح خط الأساس.',
    },
    {
      icon: 'language',
      title: 'الكتابات والبدائل',
      text: 'الحروف غير الموجودة في خط الويب تأتي من عائلة أخرى فقد يصبح سطر واحد أعلى من جيرانه.',
    },
  ],
  columnsHeading: 'ما الذي يتحرك ولماذا',
  columns: [
    [
      'لنأخذ فقرة عادية. في الخط ',
      { italic: 'الاحتياطي' },
      ' تشغل أربعة أسطر، وفي ',
      { bold: 'خط الويب' },
      ' تحتاج الكلمات نفسها إلى خمسة. وينزلق كل ما تحتها بسطر واحد، وهذا هو ',
      { bold: 'انزياح التخطيط' },
      '.',
    ],
    [
      'العرض نصف الحكاية فقط. لكل خط ',
      { italic: 'ascent' },
      ' و',
      { italic: 'descent' },
      ' و',
      { italic: 'line gap' },
      ' خاصة به. ومع ',
      { code: 'line-height: normal' },
      ' يبني المتصفح السطر منها، فيختلف الارتفاع باختلاف الخط حتى بالحجم نفسه.',
    ],
    [
      'العناصر المضمّنة تضيف ضغطها: مقطع ',
      { bold: 'عريض' },
      '، وعبارة ',
      { italic: 'مائلة' },
      '، وحرف مرتفع',
      { sup: '٢' },
      ' أو رمز مثل ™ قد يأتي من خط آخر فيمدّ السطر.',
    ],
    [
      'العناوين أكثر الضحايا وضوحًا. عنوان كبير يقفز بضع بكسلات يسحب المقال كله معه، ولذلك تستحق العناوين والنصوص خطوطًا احتياطية منفصلة.',
    ],
    [
      'يمكن أيضًا ',
      { italic: 'إعادة موازنة' },
      ' النص. تغيّر ',
      { code: 'text-wrap: balance' },
      ' و',
      { code: 'text-wrap: pretty' },
      ' أماكن كسر الأسطر، فاختبر بهما وبدونهما.',
    ],
    [
      'العلاج مملّ لكنه فعّال: كبّر الخط الاحتياطي أو صغّره بـ ',
      { code: 'size-adjust' },
      ' وامنحه مقاييس خط الويب الرأسية بـ ',
      { code: 'ascent-override' },
      ' و',
      { code: 'descent-override' },
      ' و',
      { code: 'line-gap-override' },
      '.',
    ],
  ],
  quote: {
    text: 'أفضل انزياح في التخطيط هو الذي لا يلاحظه أحد.',
    cite: '— قاعدة عملية',
  },
  listHeading: 'قائمة تحقق للإصدار القادم',
  list: [
    ['اختر ', { bold: 'الخط الاحتياطي' }, ' لكل نظام، لا خطًا واحدًا للجميع.'],
    [
      'قارن الأوزان ',
      { italic: 'العادي' },
      ' و',
      { bold: 'العريض' },
      ' و',
      { italic: 'المائل' },
      ' كلًّا على حدة.',
    ],
    ['اختبر الأسطر الطويلة والقصيرة ومع تفعيل ', { code: 'text-wrap' }, '.'],
    ['افحص الكتابات التي لا تقرؤها: العربية واليابانية والسيريلية.'],
  ],
  tableHeading: 'من أين يأخذ السطر ارتفاعه',
  tableHead: ['السبب', 'الأثر'],
  tableRows: [
    ['حجم الخط', 'يضرب كل المقاييس'],
    ['line-height', 'يتجاوز مقاييس الخط نفسه'],
    ['الصعود والهبوط', 'يحددان منطقة محتوى السطر'],
    ['حروف الخط الاحتياطي', 'قد ترفع سطرًا واحدًا'],
    ['الحرف المرتفع والمنخفض', 'يدفعان صندوق السطر لأعلى أو لأسفل'],
  ],
  glyphsHeading: 'رموز خاصة',
  glyphs: '٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩ ، ؛ ؟ « » … – — © ® ™ § ¶ • % ٪ ° ± × ÷ ≈ ≠ ≤ ≥ ∞ ← → ↑ ↓ ﷺ ﷲ ﻻ ﷼',
  footer:
    'نُسّق النص بخطين: العناوين والنص من عائلتين مختلفتين. بدّل العرض في الأعلى لمقارنة خط الويب بخطه الاحتياطي المضبوط.',
};

const ja: Article = {
  id: 'ja',
  label: '日本語',
  lang: 'ja',
  dir: 'ltr',
  kicker: 'フィールドノート · 第7号 · タイポグラフィと表示速度',
  title: 'フォントの読み込みでページが跳ねる理由',
  lead: 'Webフォントはテキストが最初に描画された少しあとに届きます。それまでブラウザは代替フォントを表示し、本物のフォントに切り替わると、各行の幅や各ブロックの高さが変わることがあります。',
  meta: 'fontstay チーム · 読了12分 · © 2026 · 話の半分は字体メトリクスにあります',
  factors: [
    {
      icon: 'text-width',
      title: '字幅',
      text: '書体ごとに文字の幅が違うため、同じ文章でも折り返す位置が変わります。',
    },
    {
      icon: 'text-height',
      title: '行の高さ',
      text: 'フォント自身のアセントとディセント、そして line-height の指定が行の占める高さを決めます。',
    },
    {
      icon: 'arrows-up-down',
      title: '縦のメトリクス',
      text: 'アセント、ディセント、行間はフォントファイルに含まれ、数値の違う代替フォントはベースラインをずらします。',
    },
    {
      icon: 'language',
      title: '文字種とフォールバック',
      text: 'Webフォントにない文字は別のファミリーから補われ、1行だけ周囲より高くなることがあります。',
    },
  ],
  columnsHeading: '何が動くのか、なぜか',
  columns: [
    [
      '普通の段落を考えてみましょう。',
      { italic: '代替' },
      'フォントでは4行ですが、',
      { bold: 'Webフォント' },
      'では同じ言葉が5行になります。その下のすべてが1行ぶんずれます。これが',
      { bold: 'レイアウトシフト' },
      'です。',
    ],
    [
      '幅は話の半分にすぎません。フォントにはそれぞれ',
      { italic: 'ascent' },
      '、',
      { italic: 'descent' },
      '、',
      { italic: 'line gap' },
      'があります。',
      { code: 'line-height: normal' },
      ' ではブラウザがこれらから行を組み立てるため、同じサイズでもフォントが違えば高さも変わります。',
    ],
    [
      'インライン要素も影響します。',
      { bold: '太字' },
      '、',
      { italic: '斜体' },
      'の語句、上付き文字',
      { sup: '2' },
      '、「™」のような記号が別の書体から来て、その行を押し広げることがあります。',
    ],
    [
      '見出しがいちばん目立つ被害者です。大きな見出しが数ピクセル跳ねるだけで記事全体が引きずられるため、見出しと本文には別々の代替フォントが必要です。',
    ],
    [
      'テキストの',
      { italic: '再配分' },
      'もあります。',
      { code: 'text-wrap: balance' },
      ' や ',
      { code: 'text-wrap: pretty' },
      ' は改行位置を変えるので、有無の両方で確かめましょう。',
    ],
    [
      '対策は地味ですが効果的です。',
      { code: 'size-adjust' },
      ' で代替フォントを拡大縮小し、',
      { code: 'ascent-override' },
      '、',
      { code: 'descent-override' },
      '、',
      { code: 'line-gap-override' },
      ' でWebフォントの縦メトリクスを与えます。',
    ],
  ],
  quote: {
    text: '最良のレイアウトシフトは、誰にも気づかれないものだ。',
    cite: '—— 経験則',
  },
  listHeading: '次のリリースに向けたチェックリスト',
  list: [
    ['全員に1つではなく、システムごとに', { bold: '代替フォント' }, 'を選ぶ。'],
    [{ italic: '標準' }, '、', { bold: '太字' }, '、', { italic: '斜体' }, 'を別々に比較する。'],
    ['長い行と短い行、そして ', { code: 'text-wrap' }, ' を有効にして試す。'],
    ['読めない文字種も確認する：アラビア語、日本語、キリル文字。'],
  ],
  tableHeading: '行の高さはどこから来るか',
  tableHead: ['原因', '影響'],
  tableRows: [
    ['フォントサイズ', 'すべてのメトリクスを拡大縮小'],
    ['line-height', 'フォント自身のメトリクスを上書き'],
    ['アセントとディセント', '行の内容領域を決める'],
    ['代替フォントの字形', '1行だけを高くすることがある'],
    ['上付き・下付き', 'ラインボックスを上下に押す'],
  ],
  glyphsHeading: '特殊文字',
  glyphs:
    '「 」 『 』 、 。 ・ 〜 ※ ○ ● ◎ △ ▽ ★ ☆ ♪ → ← ↑ ↓ ①②③ ㈱ ㎜ ㎏ ℃ ％ ＆ ＠ ａｂｃ １２３ ヴ ゛ ゜ 々 〆',
  footer:
    '2つの書体で組んでいます。見出しと本文は別のファミリーです。上の表示を切り替えて、Webフォントと調整済みの代替フォントを比べてください。',
};

export const ARTICLES: Record<ArticleId, Article> = { en, ru, ar, ja };
