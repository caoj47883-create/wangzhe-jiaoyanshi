# -*- coding: utf-8 -*-
import json, urllib.request, re, sys
from pathlib import Path
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(r'D:\图吧工具箱\wangzhe-apk')
DATA=ROOT/'next/src/data/data.json'
OUT=ROOT/'next/public/coaches'
TARGET={
 '王小贱':'1472949922','听安':'430044260','张老三':'1313155752','寂然':'591540',
 '心态':'174946659','耀扬':'1203321154','德芙':'1759091702','六点六':'474570927',
 '南瓜':'338167021','桑杰':'3493273362500470','荒尾':'651220092','云天河':'1699257101',
 '微凉':'1588404397','宗师':'3546655609587861','致命换弹':'396401714','益达':'298590209',
}
cands={}
for fn in ['.tmp-coach-search-results.json','.tmp-coach-search3.json']:
    p=ROOT/fn
    if not p.exists(): continue
    data=json.loads(p.read_text(encoding='utf-8'))
    for item in data:
        for c in item.get('candidates') or item.get('cands') or []:
            href=c.get('href') or ''
            m=re.search(r'space\.bilibili\.com/(\d+)',href)
            if m: cands[m.group(1)]=c

d=json.loads(DATA.read_text(encoding='utf-8'))
found=0; failed=[]
for name,uid in TARGET.items():
    c=cands.get(uid)
    if not c: failed.append((name,'no candidate')); continue
    url=c['src']
    dest=OUT/f'real-{uid}.jpg'
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'})
        raw=urllib.request.urlopen(req,timeout=30).read()
        tmp=OUT/f'.{uid}.raw'; tmp.write_bytes(raw)
        im=Image.open(tmp).convert('RGB'); w,h=im.size; side=min(w,h)
        im=im.crop(((w-side)//2,(h-side)//2,(w-side)//2+side,(h-side)//2+side)).resize((160,160),Image.LANCZOS)
        im.save(dest,'JPEG',quality=84,optimize=True); tmp.unlink(missing_ok=True)
        for coach in d['coaches']:
            if coach['name']==name:
                coach['avatar']=f'coaches/{dest.name}'
                found+=1
                print('ok',name,c.get('name'),uid)
                break
    except Exception as e:
        failed.append((name,str(e))); print('FAIL',name,e)
for coach in d['coaches']:
    if not coach.get('avatar'): coach['avatar']='coaches/_default.jpg'
DATA.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('found',found,'failed',failed)
print('defaults',[c['name'] for c in d['coaches'] if c['avatar'].endswith('_default.jpg')])