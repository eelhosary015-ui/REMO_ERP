sed -i '/color: "#ffffff",/c\
                    color: isLight ? "#ffffff" : "#f8fafc",' src/components/Login.tsx

sed -i '/: "0 1px 0 #94a3b8, 0 2px 0 #64748b, 0 3px 0 #475569, 0 4px 0 #334155, 0 5px 0 #1e293b, 0 6px 1px rgba(0,0,0,.5), 0 0 15px rgba(34,211,238,0.4), 0 1px 5px rgba(34,211,238,0.3), 0 3px 15px rgba(34,211,238,0.2), 0 5px 25px rgba(34,211,238,0.1)",/c\
                      : "0 1px 0 #334155, 0 2px 0 #1e293b, 0 3px 0 #0f172a, 0 0 20px rgba(34,211,238,0.4), 0 10px 15px rgba(0,0,0,0.5), 0 20px 25px rgba(0,0,0,0.4)",' src/components/Login.tsx

sed -i '/? "0 1px 0 #cbd5e1, 0 2px 0 #94a3b8, 0 3px 0 #64748b, 0 4px 0 #475569, 0 5px 0 #334155, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.3), 0 3px 5px rgba(0,0,0,.2), 0 5px 10px rgba(0,0,0,.25), 0 10px 10px rgba(0,0,0,.2), 0 20px 20px rgba(0,0,0,.15)"/c\
                      ? "0 1px 0 #e2e8f0, 0 2px 0 #cbd5e1, 0 3px 0 #94a3b8, 0 4px 0 #64748b, 0 5px 0 #475569, 0 10px 15px rgba(0,0,0,0.15), 0 20px 25px rgba(0,0,0,0.1)"' src/components/Login.tsx
