sed -i '/{\/\* Glowing Circular Lock Icon Header - 3D with orbiting rings \*\/}/,/<\/div>/ {
  /{\/\* Glowing Circular Lock Icon Header - 3D with orbiting rings \*\/}/c\
            {/* 3D OPPO Logo Header */}\
            <div className="flex flex-col items-center text-center mb-8 preserve-3d" style={{ transformStyle: "preserve-3d" }}>\
              <div className="relative w-full flex items-center justify-center mb-2 preserve-3d" style={{ transformStyle: "preserve-3d", transform: `translateZ(40px)` }}>\
                {/* Glowing orb behind logo */}\
                <div \
                  className={`absolute w-32 h-32 rounded-full blur-2xl ${isLight ? "bg-blue-400/20" : "bg-cyan-500/20"}`}\
                  style={{ transform: "translateZ(-20px)" }}\
                />\
                <div \
                  className={`font-black text-6xl tracking-widest uppercase transition-colors preserve-3d`}\
                  style={{\
                    fontFamily: \"\x27Montserrat\x27, \x27Arial\x27, sans-serif\",\
                    color: isLight ? "#ffffff" : "#1e293b",\
                    textShadow: isLight\
                      ? "0 1px 0 #cbd5e1, 0 2px 0 #94a3b8, 0 3px 0 #64748b, 0 4px 0 #475569, 0 5px 0 #334155, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.3), 0 3px 5px rgba(0,0,0,.2), 0 5px 10px rgba(0,0,0,.25), 0 10px 10px rgba(0,0,0,.2), 0 20px 20px rgba(0,0,0,.15)"\
                      : "0 1px 0 #334155, 0 2px 0 #1e293b, 0 3px 0 #0f172a, 0 4px 0 #020617, 0 5px 0 #000000, 0 6px 1px rgba(0,0,0,.5), 0 0 5px rgba(0,0,0,.5), 0 1px 3px rgba(0,0,0,.8), 0 3px 5px rgba(0,0,0,.6), 0 5px 10px rgba(0,0,0,.7), 0 10px 10px rgba(0,0,0,.6), 0 20px 20px rgba(0,0,0,.5)",\
                    transform: `rotateX(15deg) rotateY(-10deg) translateZ(30px)`,\
                  }}\
                >\
                  OPPO\
                </div>\
              </div>
  /<\/div>/!d
  /<\/div>/d
}' src/components/Login.tsx
