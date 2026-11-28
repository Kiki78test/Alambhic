# Applique les réglages Alamb'hic au projet Android généré par « npx cap add android » (appelé par la fabrication GitHub).
# Repris d'Airmony, simplifié : permissions, icônes, écran de démarrage bleu nuit, clé de test fixe, numéro de version.
import os, re, shutil, sys
here = os.path.dirname(os.path.abspath(__file__))
app = os.path.join(sys.argv[1] if len(sys.argv) > 1 else 'android', 'app')
res = os.path.join(here, 'res')
for root, dirs, files in os.walk(res):
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), res); dst = os.path.join(app, 'src', 'main', 'res', rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy(os.path.join(root, f), dst)
man = os.path.join(app, 'src', 'main', 'AndroidManifest.xml'); s = open(man).read()
perms = ['INTERNET', 'VIBRATE', 'POST_NOTIFICATIONS', 'ACCESS_NETWORK_STATE', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']
s = s.replace('</manifest>', ''.join('    <uses-permission android:name="android.permission.%s" />\n' % p for p in perms if 'android.permission.%s"' % p not in s) + '</manifest>')
open(man, 'w').write(s)
sty = os.path.join(app, 'src', 'main', 'res', 'values', 'styles.xml')
if os.path.exists(sty):
    st = open(sty).read()
    def fix(m):
        body = m.group(2)
        for k, v in [('windowSplashScreenBackground', '#0a1626'), ('android:windowBackground', '#0a1626'), ('android:background', '#0a1626')]:
            body = re.sub(r'\s*<item name="%s">[^<]*</item>' % re.escape(k), '', body)
            body += '\n        <item name="%s">%s</item>' % (k, v)
        return m.group(1) + body + '\n    ' + m.group(3)
    st = re.sub(r'(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)([\s\S]*?)\s*(</style>)', fix, st, count=1)
    open(sty, 'w').write(st)
gr = os.path.join(app, 'build.gradle'); g = open(gr).read()
# clé de test fixe (créée à la fabrication si absente du dépôt) : chaque version s'installe par-dessus la précédente
ks = os.path.join(here, 'alambhic-test.jks').replace('\\', '/')
if 'alambhic-test.jks' not in g:
    g = re.sub(r'android\s*\{', "android {\n    signingConfigs {\n        debug {\n            storeFile file('%s')\n            storePassword 'alambhic-test'\n            keyAlias 'alambhic'\n            keyPassword 'alambhic-test'\n        }\n    }" % ks, g, count=1)
if 'AM_KS_FILE' not in g:
    g = g.replace("    signingConfigs {\n", "    signingConfigs {\n        release {\n            if (System.getenv('AM_KS_FILE')) {\n                storeFile file(System.getenv('AM_KS_FILE'))\n                storePassword System.getenv('AM_KS_PASS')\n                keyAlias System.getenv('AM_KEY_ALIAS')\n                keyPassword System.getenv('AM_KEY_PASS')\n            }\n        }\n", 1)
    g = re.sub(r'(buildTypes\s*\{\s*release\s*\{)', r"\1\n            if (System.getenv('AM_KS_FILE')) signingConfig signingConfigs.release", g, count=1)
g = re.sub(r'versionCode\s+\d+', "versionCode((System.getenv('AM_VERSION_CODE') ?: '1') as Integer)", g, count=1)
g = re.sub(r'versionName\s+"[^"]*"', "versionName(System.getenv('AM_VERSION_NAME') ?: '0.1')", g, count=1)
open(gr, 'w').write(g)
print("Android : réglages Alamb'hic appliqués")
