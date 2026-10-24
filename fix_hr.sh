cat src/components/HR_clean.tsx > src/components/HR.tsx
cat << 'INNER_EOF' >> src/components/HR.tsx
                            )}
                          </div>
                        </div>
                        <div className="mb-2">
                          <p className={`font-bold ${isActive ? cc.color : "text-slate-500"} mb-1`}>
                            {p.amount > 0 ? `${p.amount} ${p.type === "days" ? "أيام" : "ساعات"}` : "بدون خصم"}
                          </p>
                          {p.reason && (
                            <p className="text-slate-600 text-sm">{p.reason}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50">
                          <span className="text-xs text-slate-500 font-medium">
                            {new Date(p.date).toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
        )}
      </AnimatePresence>
      </AnimatePresence>
    </div>
  );
};

export default HRProfessionalSuite;
INNER_EOF
npx tsc --noEmit src/components/HR.tsx
