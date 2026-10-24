sed -i '/color: isLight ? "#ffffff" : "#1e293b",/c\
                    color: "#ffffff",' src/components/Login.tsx

sed -i '/: "0 1px 0 #334155, 0 2px 0 #1e293b, 0 3px 0 #0f172a, 0 4px 0 #020617, 0 5px 0 #000000, 0 6px 1px rgba(0,0,0,.5), 0 0 5px rgba(0,0,0,.5), 0 1px 3px rgba(0,0,0,.8), 0 3px 5px rgba(0,0,0,.6), 0 5px 10px rgba(0,0,0,.7), 0 10px 10px rgba(0,0,0,.6), 0 20px 20px rgba(0,0,0,.5)",/c\
                      : "0 1px 0 #94a3b8, 0 2px 0 #64748b, 0 3px 0 #475569, 0 4px 0 #334155, 0 5px 0 #1e293b, 0 6px 1px rgba(0,0,0,.5), 0 0 15px rgba(34,211,238,0.4), 0 1px 5px rgba(34,211,238,0.3), 0 3px 15px rgba(34,211,238,0.2), 0 5px 25px rgba(34,211,238,0.1)",' src/components/Login.tsx
