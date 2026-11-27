# -*- coding: utf-8 -*-
import json, math, random, re, sys, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'D:\图吧工具箱\wangzhe-apk')
DATA = ROOT/'next/src/data/data.json'
OUT = ROOT/'next/public/coaches'
OUT.mkdir(parents=True, exist_ok=True)
d = json.loads(DATA.read_text(encoding='utf-8'))

GROUP = {}
for n in ['张大仙','吕德华','倪海杉','铁根er','心态','浣熊君','小兽','猪悠','韩涵','北慕','Gemini','拖米','瓶子','李九','潇洒']:
    GROUP[n]='theory'
for n in ['梦泪','一诺','花海','暖阳','小胖','Fly','清清','久诚','Cat','无畏','妖刀','钟意','向鱼','蓝烟','诺言','六点六','大帅','孤影','剑仙','骚白']:
    GROUP[n]='peak'
for n in ['青帝','天赐','韩跑跑','王小贱','听安','张老三','树叶','赖神','明眸','露雪','德芙','寂然','耀扬','耀神','玖欣','仓颉']:
    GROUP[n]='master'

NEW = [
 ('南瓜','douyin',['铠','夏侯惇','项羽'],'国服铠代表，坦边对线与团战切入教学。','南瓜 王者荣耀 铠'),
 ('阿电','bilibili',['元歌','镜','澜'],'元歌本体与傀儡切换细节，刺客手法教学。','阿电 元歌'),
 ('桑杰','bilibili',['元歌','花木兰','马超'],'巅峰赛元歌绝活，边路操作与对线压制。','桑杰 元歌 王者荣耀'),
 ('故氏','bilibili',['孙尚香','公孙离','马可波罗'],'国服射手，对线细节与团战站位拆解。','故氏 王者荣耀 射手'),
 ('荒尾','bilibili',['露娜','镜','澜'],'露娜月下无限连与野区节奏教学。','荒尾 露娜'),
 ('小锦儿','bilibili',['李白','韩信','澜'],'国服李白，刷野路线与进场时机教学。','小锦儿 李白'),
 ('酒馆','douyin',['貂蝉','不知火舞','海月'],'貂蝉法刺绝活，二技能规避与团战拉扯。','酒馆 貂蝉 王者荣耀'),
 ('云天河','douyin',['韩信','李白','镜'],'韩信野核节奏，刷经济与带线牵制。','云天河 韩信'),
 ('陈比克','bilibili',['鲁班七号','后羿','黄忠'],'射手绝活，走位输出与保命细节。','陈比克 鲁班七号'),
 ('微凉','bilibili',['镜','露娜','暃'],'镜的飞雷神与野区入侵思路。','微凉 镜 王者荣耀'),
 ('宗师','bilibili',['云缨','澜','镜'],'云缨枪意连招与团战进场教学。','王者荣耀宗师 云缨'),
 ('致命换弹','douyin',['孙尚香','虞姬','公孙离'],'孙尚香一炮秒C，发育路对线细节。','致命换弹 孙尚香'),
 ('小七','bilibili',['大乔','孙膑','蔡文姬'],'大乔体系与辅助转线教学。','小七 大乔 王者荣耀'),
 ('益达','bilibili',['花木兰','关羽','马超'],'花木兰轻重剑切换与对抗路细节。','益达 花木兰'),
]
for name,plat,heroes,desc,q in NEW:
    d['coaches'].append({'name':name,'platform':plat,'heroes':heroes,'desc':desc,'group':'master','query':q})

# ensure group for existing, attach query defaults
for c in d['coaches']:
    c['group'] = c.get('group') or GROUP.get(c['name'],'master')
    c.setdefault('query', c['name'])

QUERY = {
 '张大仙':'指法芬芳张大仙','梦泪':'AG超玩会王者荣耀梦泪','孤影':'厌世小孤影','剑仙':'剑仙 王者荣耀',
 '骚白':'骚白 王者荣耀','耀神':'耀神 王者荣耀','天赐':'天赐 王者荣耀','韩跑跑':'韩跑跑 王者荣耀',
 '青帝':'青帝 王者荣耀','吕德华':'吕德华 王者荣耀','赖神':'赖神 王者荣耀','树叶':'树叶 孙策 王者荣耀',
 '张老三':'张老三 王者荣耀','倪海杉':'倪海杉','一诺':'AG一诺','花海':'eStar花海','暖阳':'WB暖阳',
 '小胖':'狼队小胖','Fly':'狼队Fly','清清':'TTG清清','久诚':'Hero久诚','Cat':'Cat 王者荣耀',
 '无畏':'无畏 王者荣耀','妖刀':'妖刀 王者荣耀','钟意':'AG钟意','向鱼':'狼队向鱼','铁根er':'铁根er',
 'Gemini':'Gemini郭家毅','拖米':'拖米阿叔','北慕':'北慕kkk','韩涵':'韩涵吃汉堡','寂然':'寂然 百里守约',
 '浣熊君':'浣熊君 王者荣耀','心态':'心态 关羽 王者荣耀','蓝烟':'蓝烟 王者荣耀','耀扬':'耀扬 百里守约',
 '明眸':'明眸 关羽 王者荣耀','露雪':'露雪 兰陵王','猪悠':'是猪悠啊','德芙':'德芙 蔡文姬 王者荣耀',
 '瓶子':'解说瓶子','李九':'解说李九','潇洒':'解说潇洒','诺言':'诺言 王者荣耀','六点六':'六点六 王者荣耀',
 '小兽':'AG小兽','大帅':'AG大帅','玖欣':'玖欣 大乔','仓颉':'仓颉 海月','听安':'听安 元歌',
 '王小贱':'王小贱 孙悟空','张老三':'张老三 芈月',
}
for c in d['coaches']:
    c['query'] = QUERY.get(c['name'], c.get('query') or c['name'])

def bili_search(q, cookie):
    url='https://api.bilibili.com/x/web-interface/search/type?'+urllib.parse.urlencode({'search_type':'bili_user','keyword':q,'page':1})
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36','Referer':'https://www.bilibili.com/','Cookie':cookie})
    with urllib.request.urlopen(req,timeout=20) as r:
        return json.loads(r.read().decode('utf-8'))

def make_cookie():
    return 'buvid3='+''.join(random.choices('0123456789ABCDEF',k=32))+'; b_nut=%d'%int(time.time())

cookie=make_cookie()
selected=[]
for i,c in enumerate(d['coaches'],1):
    q=c['query']; res=[]
    for attempt in range(4):
        try:
            data=bili_search(q,cookie); res=data.get('data',{}).get('result',[]) or []
            if res: break
        except Exception as e:
            print('search retry',c['name'],e)
            time.sleep(2.0)
            cookie=make_cookie()
    name=c['name']
    def score(r):
        uname=r.get('uname','') or ''
        s=0
        if uname==name: s+=200
        if name in uname: s+=80
        # any distinctive chars
        if any(ch in uname for ch in name if len(ch)>0): s+=20
        s += min(120, math.log10((r.get('fans') or 0)+1)*25)
        upic=r.get('upic') or ''
        if 'noface' in upic: s-=500
        return s
    res=[r for r in res if (r.get('upic') or '').startswith('//') and 'noface' not in (r.get('upic') or '')]
    res.sort(key=score, reverse=True)
    pick=res[0] if res else None
    if pick:
        upic=pick['upic']
        url='https:'+upic if upic.startswith('//') else upic
        dest=OUT/f'coach-{i:02d}.jpg'
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'})
            raw=urllib.request.urlopen(req,timeout=30).read()
            tmp=OUT/f'coach-{i:02d}.raw'
            tmp.write_bytes(raw)
            im=Image.open(tmp).convert('RGB')
            w,h=im.size; side=min(w,h)
            im=im.crop(((w-side)//2,(h-side)//2,(w-side)//2+side,(h-side)//2+side)).resize((160,160),Image.LANCZOS)
            im.save(dest,'JPEG',quality=84,optimize=True)
            tmp.unlink(missing_ok=True)
            c['avatar']=f'coaches/coach-{i:02d}.jpg'
            selected.append((i,c['name'],pick.get('uname'),pick.get('fans'),url))
            print(f'{i:02d} {c["name"]} -> {pick.get("uname")} fans={pick.get("fans")}')
        except Exception as e:
            print('download fail',c['name'],e)
    else:
        print('NO MATCH',c['name'])
    # remove helper query field later
    time.sleep(0.9)

# ensure all have avatar; fallback
fallback=OUT/'_default.jpg'
if not fallback.exists():
    im=Image.new('RGB',(160,160),(51,112,255)); dr=ImageDraw.Draw(im)
    dr.ellipse((48,30,112,94),fill=(255,255,255)); dr.ellipse((20,90,140,190),fill=(255,255,255))
    im.save(fallback,'JPEG',quality=84)
for c in d['coaches']:
    if not c.get('avatar'): c['avatar']='coaches/_default.jpg'
    c.pop('query',None)

# groups order
order={'theory':0,'peak':1,'master':2}
d['coaches'].sort(key=lambda c:(order.get(c['group'],9), c['name']))
d['stats']['coaches']=len(d['coaches'])
DATA.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('coaches',len(d['coaches']),'groups', {g:sum(1 for c in d['coaches'] if c['group']==g) for g in order})
print('selected',len(selected),'fallbacks',sum(1 for c in d['coaches'] if c['avatar'].endswith('_default.jpg')))