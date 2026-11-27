# -*- coding: utf-8 -*-
import json, urllib.request, sys
from pathlib import Path
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(r'D:\图吧工具箱\wangzhe-apk'); DATA=ROOT/'next/src/data/data.json'; OUT=ROOT/'next/public/coaches'
repl = {
 '仓颉': ('小予神','bilibili',['关羽','马超','哪吒'],'国服关羽，正面强开与绕后切入教学。','544467149','https://i2.hdslb.com/bfs/face/261abbbf56f1c999b2901d27d618a06ae17f423a.jpg@240w_240h_1c_1s_!web-avatar-search-user.webp'),
 '玖欣': ('亚瑟王','bilibili',['亚瑟','夏侯惇','项羽'],'国服亚瑟，坦边对线与全局支援。','2030343983','https://i1.hdslb.com/bfs/face/d45ee269480624ef591b5ff188ff014ec98df5e6.jpg@240w_240h_1c_1s_!web-avatar-search-user.webp'),
 '酒馆': ('鸭梨','bilibili',['大乔','孙膑','蔡文姬'],'国服大乔/辅助，电梯体系与转线教学。','1625092935','https://i1.hdslb.com/bfs/face/a42ec6e0cb8227a53d225f1765114336cbdeb866.jpg@240w_240h_1c_1s_!web-avatar-search-user.webp'),
 '陈比克': ('小矛神','bilibili',['马超','关羽','司空震'],'国服马超，边路拉扯与支援时机。','286757278','https://i1.hdslb.com/bfs/face/8e120cb88e98c712bd1278b75dd99be85009dd1d.jpg@240w_240h_1c_1s_!web-avatar-search-user.webp'),
}
d=json.loads(DATA.read_text(encoding='utf-8'))
for old,(new,plat,heroes,desc,uid,url) in repl.items():
    dest=OUT/f'real-{uid}.jpg'
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'})
    raw=urllib.request.urlopen(req,timeout=30).read(); tmp=OUT/f'.{uid}.raw'; tmp.write_bytes(raw)
    im=Image.open(tmp).convert('RGB'); w,h=im.size; side=min(w,h)
    im=im.crop(((w-side)//2,(h-side)//2,(w-side)//2+side,(h-side)//2+side)).resize((160,160),Image.LANCZOS)
    im.save(dest,'JPEG',quality=84,optimize=True); tmp.unlink(missing_ok=True)
    for c in d['coaches']:
        if c['name']==old:
            c.update({'name':new,'platform':plat,'heroes':heroes,'desc':desc,'avatar':f'coaches/{dest.name}'})
            print('replaced',old,'->',new)
DATA.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('total',len(d['coaches']),'defaults',sum(1 for c in d['coaches'] if c.get('avatar','').endswith('_default.jpg')))