        {/* TAB 5: LEAVES */}
        {activeTab === "leaves" && (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-4">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600 mx-auto shadow-inner">
                <Calendar className="w-8 h-8" />
              </div>
              <h2 className={`text-xl font-black ${isLight ? "text-slate-800" : "text-white"}`}>رصيد الإجازات</h2>
              <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>متابعة الرصيد السنوي والمستهلك والمتبقي</p>
            </div>

            {/* Leave Balances & Consumption Card Widget */}
            <div className={`${isLight ? "bg-white border-slate-200/80 shadow-md backdrop-blur-sm" : "bg-slate-900 border-slate-800/80 shadow-lg"} border rounded-3xl p-5 sm:p-6 space-y-6 transition-all duration-300`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm sm:text-base ${isLight ? "text-slate-800" : "text-slate-100"}`}>
                      رصيد الإجازات المستحق
                    </h3>
                    <p className={`text-[10px] sm:text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      تحديث تلقائي وفوري للرصيد والمخصومات
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${isLight ? "bg-purple-100/70 text-purple-700" : "bg-purple-950/80 text-purple-300 border border-purple-800/50"}`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر
                </span>
              </div>

              {(() => {
                const annTotal = employee?.annual_leave_total || 21;
                const annBal = employee?.annual_leave_balance !== undefined && employee?.annual_leave_balance !== null ? Number(employee.annual_leave_balance) : annTotal;
                const annConsumed = employee?.annual_leave_consumed !== undefined ? Number(employee.annual_leave_consumed) : Math.max(0, annTotal - annBal);

                const casTotal = employee?.casual_leave_total || 6;
                const casBal = employee?.casual_leave_balance !== undefined && employee?.casual_leave_balance !== null ? Number(employee.casual_leave_balance) : casTotal;
                const casConsumed = employee?.casual_leave_consumed !== undefined ? Number(employee.casual_leave_consumed) : Math.max(0, casTotal - casBal);

                const sickTotal = employee?.sick_leave_total || 14;
                const sickBal = employee?.sick_leave_balance !== undefined && employee?.sick_leave_balance !== null ? Number(employee.sick_leave_balance) : sickTotal;
                const sickConsumed = employee?.sick_leave_consumed !== undefined ? Number(employee.sick_leave_consumed) : Math.max(0, sickTotal - sickBal);

                return (
                  <div className="flex flex-col gap-5">
                    {/* Annual */}
                    <div className={`${isLight ? "bg-gradient-to-br from-purple-50/50 via-white to-slate-50/50 border-purple-100 shadow-sm hover:shadow-md hover:border-purple-200" : "bg-gradient-to-br from-purple-950/20 via-slate-900 to-slate-950 border-purple-900/30 hover:border-purple-700/40"} border rounded-2xl p-4 sm:p-5 space-y-4 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-2 text-purple-700 dark:text-purple-300 text-sm">
                          <span className="text-xl">🏖️</span>
                          <span>الإجازة السنوية</span>
                        </span>
                        <span className={`text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg ${isLight ? "bg-purple-100 text-purple-800" : "bg-purple-900/60 text-purple-200"}`}>
                          {annTotal} يوم الإجمالي
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-center font-bold">
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-rose-500/10 text-rose-700 border border-rose-100" : "bg-rose-950/40 text-rose-300 border border-rose-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">تم استهلاكه</div>
                          <div className="text-lg font-black">{annConsumed} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-100" : "bg-emerald-950/40 text-emerald-300 border border-emerald-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">الرصيد المتبقي</div>
                          <div className="text-lg font-black">{annBal} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((annBal / annTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (annBal / annTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Casual */}
                    <div className={`${isLight ? "bg-gradient-to-br from-amber-50/50 via-white to-slate-50/50 border-amber-100 shadow-sm hover:shadow-md hover:border-amber-200" : "bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 border-amber-900/30 hover:border-amber-700/40"} border rounded-2xl p-4 sm:p-5 space-y-4 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                          <span className="text-xl">⚡</span>
                          <span>الإجازة العارضة</span>
                        </span>
                        <span className={`text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg ${isLight ? "bg-amber-100 text-amber-800" : "bg-amber-900/60 text-amber-200"}`}>
                          {casTotal} أيام الإجمالي
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-center font-bold">
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-rose-500/10 text-rose-700 border border-rose-100" : "bg-rose-950/40 text-rose-300 border border-rose-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">تم استهلاكه</div>
                          <div className="text-lg font-black">{casConsumed} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-100" : "bg-emerald-950/40 text-emerald-300 border border-emerald-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">الرصيد المتبقي</div>
                          <div className="text-lg font-black">{casBal} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((casBal / casTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (casBal / casTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sick */}
                    <div className={`${isLight ? "bg-gradient-to-br from-blue-50/50 via-white to-slate-50/50 border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200" : "bg-gradient-to-br from-blue-950/20 via-slate-900 to-slate-950 border-blue-900/30 hover:border-blue-700/40"} border rounded-2xl p-4 sm:p-5 space-y-4 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                          <span className="text-xl">🏥</span>
                          <span>الإجازة المرضية</span>
                        </span>
                        <span className={`text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg ${isLight ? "bg-blue-100 text-blue-800" : "bg-blue-900/60 text-blue-200"}`}>
                          {sickTotal} يوم الإجمالي
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-center font-bold">
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-rose-500/10 text-rose-700 border border-rose-100" : "bg-rose-950/40 text-rose-300 border border-rose-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">تم استهلاكه</div>
                          <div className="text-lg font-black">{sickConsumed} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-100" : "bg-emerald-950/40 text-emerald-300 border border-emerald-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">الرصيد المتبقي</div>
                          <div className="text-lg font-black">{sickBal} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((sickBal / sickTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (sickBal / sickTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Request Leave Quick Button */}
            <button
              onClick={() => {
                setActiveTab("requests");
              }}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1"
            >
              <Plus className="w-5 h-5" />
              <span>تقديم طلب إجازة جديد</span>
            </button>
          </div>
        )}
