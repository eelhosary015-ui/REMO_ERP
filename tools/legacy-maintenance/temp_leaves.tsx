            {/* Leave Balances & Consumption Card Widget */}
            <div className={`${isLight ? "bg-white/90 border-slate-200/80 shadow-md backdrop-blur-sm" : "bg-slate-900/90 border-slate-800/80 shadow-lg"} border rounded-2xl p-4 sm:p-5 space-y-4 transition-all duration-300`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`font-bold text-xs sm:text-sm ${isLight ? "text-slate-800" : "text-slate-100"}`}>
                      رصيد الإجازات السنوي والمستهلك
                    </h3>
                    <p className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      تحديث تلقائي وفوري للرصيد والمخصومات
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${isLight ? "bg-purple-100/70 text-purple-700" : "bg-purple-950/80 text-purple-300 border border-purple-800/50"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Annual */}
                    <div className={`${isLight ? "bg-gradient-to-br from-purple-50/50 via-white to-slate-50/50 border-purple-100 shadow-sm hover:border-purple-200" : "bg-gradient-to-br from-purple-950/20 via-slate-900 to-slate-950 border-purple-900/30 hover:border-purple-700/40"} border rounded-xl p-3 space-y-2.5 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 text-xs">
                          <span>🏖️</span>
                          <span>الإجازة السنوية</span>
                        </span>
                        <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md ${isLight ? "bg-purple-100 text-purple-800" : "bg-purple-900/60 text-purple-200"}`}>
                          {annTotal} يوم
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-center font-bold">
                        <div className={`p-1.5 rounded-lg ${isLight ? "bg-amber-500/10 text-amber-700" : "bg-amber-950/40 text-amber-300"}`}>
                          <div className="text-[9px] opacity-80 font-normal">المستهلك</div>
                          <div>{annConsumed} يوم</div>
                        </div>
                        <div className={`p-1.5 rounded-lg ${isLight ? "bg-emerald-500/10 text-emerald-700" : "bg-emerald-950/40 text-emerald-300"}`}>
                          <div className="text-[9px] opacity-80 font-normal">المتبقي</div>
                          <div>{annBal} يوم</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((annBal / annTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all duration-500 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (annBal / annTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Casual */}
                    <div className={`${isLight ? "bg-gradient-to-br from-amber-50/50 via-white to-slate-50/50 border-amber-100 shadow-sm hover:border-amber-200" : "bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 border-amber-900/30 hover:border-amber-700/40"} border rounded-xl p-3 space-y-2.5 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs">
                          <span>⚡</span>
                          <span>الإجازة العارضة</span>
                        </span>
                        <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md ${isLight ? "bg-amber-100 text-amber-800" : "bg-amber-900/60 text-amber-200"}`}>
                          {casTotal} أيام
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-center font-bold">
                        <div className={`p-1.5 rounded-lg ${isLight ? "bg-amber-500/10 text-amber-700" : "bg-amber-950/40 text-amber-300"}`}>
                          <div className="text-[9px] opacity-80 font-normal">المستهلك</div>
                          <div>{casConsumed} يوم</div>
                        </div>
                        <div className={`p-1.5 rounded-lg ${isLight ? "bg-emerald-500/10 text-emerald-700" : "bg-emerald-950/40 text-emerald-300"}`}>
                          <div className="text-[9px] opacity-80 font-normal">المتبقي</div>
                          <div>{casBal} يوم</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((casBal / casTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (casBal / casTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sick */}
                    <div className={`${isLight ? "bg-gradient-to-br from-blue-50/50 via-white to-slate-50/50 border-blue-100 shadow-sm hover:border-blue-200" : "bg-gradient-to-br from-blue-950/20 via-slate-900 to-slate-950 border-blue-900/30 hover:border-blue-700/40"} border rounded-xl p-3 space-y-2.5 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-xs">
                          <span>🏥</span>
                          <span>الإجازة المرضية</span>
                        </span>
                        <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md ${isLight ? "bg-blue-100 text-blue-800" : "bg-blue-900/60 text-blue-200"}`}>
                          {sickTotal} يوم
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-center font-bold">
                        <div className={`p-1.5 rounded-lg ${isLight ? "bg-amber-500/10 text-amber-700" : "bg-amber-950/40 text-amber-300"}`}>
                          <div className="text-[9px] opacity-80 font-normal">المستهلك</div>
                          <div>{sickConsumed} يوم</div>
                        </div>
                        <div className={`p-1.5 rounded-lg ${isLight ? "bg-emerald-500/10 text-emerald-700" : "bg-emerald-950/40 text-emerald-300"}`}>
                          <div className="text-[9px] opacity-80 font-normal">المتبقي</div>
                          <div>{sickBal} يوم</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((sickBal / sickTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (sickBal / sickTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Location Status Card */}
            <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border rounded-2xl p-4 space-y-2 transition-colors duration-300`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                  <MapPin className="w-4 h-4" />
                  <span>الموقع الجغرافي الحالي (GPS)</span>
                </div>
                <button
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                  className={`p-1.5 ${isLight ? "text-slate-600 hover:text-slate-900 bg-slate-100" : "text-slate-400 hover:text-white bg-slate-800"} rounded-lg transition`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${locationLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {locationLoading ? (
                <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"} animate-pulse`}>جاري تحديد الموقع الجغرافي للدقة...</p>
              ) : locationError ? (
                <p className="text-xs text-rose-500">{locationError}</p>
              ) : (
                <div className={`text-xs ${isLight ? "text-slate-800 bg-slate-50 border-slate-200" : "text-slate-300 bg-slate-950/60 border-slate-800/80"} p-2.5 rounded-xl border font-mono`}>
                  {location?.address}
                </div>
              )}
            </div>

            {/* Selfie Camera Preview Box */}
            <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border rounded-2xl p-4 text-center space-y-3 transition-colors duration-300`}>
              <div className={`flex items-center justify-center gap-2 text-xs font-semibold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                <Camera className="w-4 h-4 text-emerald-500" />
                <span>التقاط صورة بصمة السيلفي المباشرة</span>
              </div>

              {/* Video Stream or Captured Image */}
              <div className={`relative w-full aspect-square max-w-[260px] mx-auto ${isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700"} rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center`}>
                {cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : capturedPhoto ? (
                  <img src={capturedPhoto} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <div className={`p-6 text-center ${isLight ? "text-slate-400" : "text-slate-500"} space-y-2`}>
                    <Camera className="w-12 h-12 mx-auto text-slate-400" />
                    <p className="text-xs">اضغط على أحد الخيارات أدناه لالتقاط صورة السيلفي والتحقق البيومتري</p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Camera Actions */}
              <div className="flex flex-col items-center justify-center gap-2 pt-1 w-full">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {!cameraActive && !capturedPhoto && (
                    <>
                      {/* Primary Camera Button: Native Mobile Camera App */}
                      <button
                        onClick={() => selfieNativeCameraInputRef.current?.click()}
                        className="py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition cursor-pointer w-full justify-center text-center"
                        title="فتح كاميرا الهاتف لالتقاط سيلفي الحضور مباشرة"
                      >
                        <Camera className="w-5 h-5 text-white" />
                        <span>فتح الكاميرا والتقاط صورة سيلفي حية 📸</span>
                      </button>

                      {/* Secondary Camera Button: Browser WebRTC Stream */}
                      <button
                        onClick={startCamera}
                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="تشغيل كاميرا المتصفح المباشرة"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                        <span>كاميرا المتصفح (Webcam)</span>
                      </button>

                      {/* Native Mobile Camera Input */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        ref={selfieNativeCameraInputRef}
                        onChange={handleSelfieFileUpload}
                        className="hidden"
                      />
                    </>
                  )}

                  {cameraActive && (
                    <button
                      onClick={capturePhoto}
                      className="py-2.5 px-5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>التقاط اللقطة الآن</span>
                    </button>
                  )}

                  {capturedPhoto && (
                    <button
                      onClick={() => {
                        setCapturedPhoto(null);
                        setCameraActive(false);
                      }}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إعادة التقاط</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Check-In / Check-Out Punch Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleAttendanceSubmit("check_in")}
                disabled={checkinLoading || !capturedPhoto}
                className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-900/30 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                <UserCheck className="w-6 h-6" />
                <span>تسجيل حضور (Check-In)</span>
              </button>

              <button
                onClick={() => handleAttendanceSubmit("check_out")}
                disabled={checkinLoading || !capturedPhoto}
                className="py-3.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-rose-900/30 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                <UserX className="w-6 h-6" />
                <span>تسجيل انصراف (Check-Out)</span>
              </button>
            </div>

            {/* Secondary Attendance Options: Biometrics Enrollment & Dynamic QR Scanner */}
            <div className="pt-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Face Biometrics Enrollment Action */}
                <button
                  onClick={handleEnrollFaceBiometrics}
                  disabled={enrollingFace || !capturedPhoto}
                  className="py-2.5 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ScanFace className="w-4 h-4 text-indigo-500" />
                  <span>
                    {enrollingFace
                      ? "جاري تحليل بصمة الوجه بالذكاء الاصطناعي..."
                      : "📸 تسجيل / تحديث بصمة الوجه البيومترية الحية"}
                  </span>
                </button>

                {/* Dynamic QR Scanner Action */}
                <button
                  onClick={() => setShowQrScanModal(true)}
                  className="py-2.5 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <QrCode className="w-4 h-4 text-emerald-500" />
                  <span>🏁 مسح رمز QR التفاعلي للفرع</span>
                </button>
              </div>

              {enrolledFaceSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl text-xs font-bold text-center">
                  {enrolledFaceSuccess}
                </div>
              )}
            </div>

            {!capturedPhoto && (
              <p className="text-[11px] text-amber-500 text-center font-medium pt-1">
                ⚠️ يرجى استخدام الكاميرا أعلاه لالتقاط صورة سيلفي حية أولاً لتفعيل تسجيل الحضور والإنصراف.
              </p>
            )}
          </div>
        )}

        {/* TAB 2: MY ATTENDANCE LOG & HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {/* Month & Year Selectors */}
            <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} flex items-center justify-between p-3 rounded-2xl border text-xs transition-colors duration-300`}>
              <span className={`font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>تاريخ السجل:</span>
              <div className="flex items-center gap-2">
                <select
                  value={historyMonth}
                  onChange={(e: any) => setHistoryMonth(Number(e.target.value))}
                  className={`${isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-slate-950 border-slate-700 text-white"} border rounded-lg px-2.5 py-1 text-xs outline-none`}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      شهر {i + 1}
                    </option>
                  ))}
                </select>
                <select
                  value={historyYear}
                  onChange={(e: any) => setHistoryYear(Number(e.target.value))}
                  className={`${isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-slate-950 border-slate-700 text-white"} border rounded-lg px-2.5 py-1 text-xs outline-none`}
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
            </div>

            {/* KPI Summary Cards for Attendance */}
            {!historyLoading && historyRecords.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>أيام الحضور المسجلة</span>
                  <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {historyRecords.filter(r => r.status === 'present').length} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>يوم</span>
                  </span>
                </div>

                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>إجمالي ساعات العمل</span>
                  <span className="text-lg font-extrabold text-teal-600 dark:text-teal-400">
                    {historyRecords.reduce((acc, r) => acc + Number(r.work_hours || 0), 0).toFixed(1)} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>ساعة</span>
                  </span>
                </div>

                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>إجمالي دقائق التأخير</span>
                  <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                    {historyRecords.reduce((acc, r) => acc + Number(r.delay_minutes || 0), 0)} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>دقيقة</span>
                  </span>
                </div>

                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>إجمالي الخصومات والجزاءات</span>
                  <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                    {historyRecords.reduce((acc, r) => acc + Number(r.penalty || 0), 0)} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>ج.م</span>
                  </span>
                </div>
              </div>
            )}

            {historyLoading ? (
              <div className={`p-8 text-center ${isLight ? "text-slate-500" : "text-slate-400"} text-xs animate-pulse`}>جاري تحميل سجل البصمات...</div>
            ) : historyRecords.length === 0 ? (
              <div className={`p-8 text-center ${isLight ? "bg-white text-slate-500 border-slate-200" : "bg-slate-900/50 text-slate-500 border-slate-800"} rounded-2xl border text-xs`}>
                لا توجد بصمات مسجلة لهذا الشهر حتى الآن.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyRecords.map((rec) => (
                  <div key={rec.id} className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border rounded-2xl p-3.5 space-y-2 transition-colors duration-300`}>
                    <div className={`flex items-center justify-between border-b ${isLight ? "border-slate-200" : "border-slate-800"} pb-2`}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{formatDisplayDate(rec.date)}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          rec.status === "present" || rec.check_in
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {rec.status === "present" || rec.check_in ? "حاضر" : "غائب"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800/60"} border p-2 rounded-xl flex flex-col justify-between gap-1`}>
                        <div>
                          <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} block`}>وقت الحضور</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatDisplayTime(rec.check_in)}</span>
                        </div>
                        <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/60">
                          {rec.check_in_photo && (
                            <button
                              onClick={() => setSelectedPhotoModal(rec.check_in_photo!)}
                              className="text-[10px] text-teal-400 font-semibold flex items-center gap-1 hover:underline"
                            >
                              <span>📸 عرض سيلفي الدخول</span>
                            </button>
                          )}
                          {rec.check_in_location && (
                            <span className="text-[9px] text-slate-400 truncate" title={rec.check_in_location}>
                              📍 {rec.check_in_location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-2 rounded-xl flex flex-col justify-between gap-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block">وقت الإنصراف</span>
                          <span className="font-bold text-rose-400">{formatDisplayTime(rec.check_out)}</span>
                        </div>
                        <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/60">
                          {rec.check_out_photo && (
                            <button
                              onClick={() => setSelectedPhotoModal(rec.check_out_photo!)}
                              className="text-[10px] text-teal-400 font-semibold flex items-center gap-1 hover:underline"
                            >
                              <span>📸 عرض سيلفي الخروج</span>
                            </button>
                          )}
                          {rec.check_out_location && (
                            <span className="text-[9px] text-slate-400 truncate" title={rec.check_out_location}>
                              📍 {rec.check_out_location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(rec.delay_minutes || 0) > 0 && (
                      <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl flex items-center justify-between font-medium">
                        <span>تأخير: {rec.delay_minutes} دقيقة</span>
                        <span>خصم: {rec.penalty || 0} ج.م</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY PAYROLL & PAYSLIP */}
        {activeTab === "payroll" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800 text-xs">
              <span className="font-semibold text-slate-300">شهر مفردات المرتب:</span>
              <div className="flex items-center gap-2">
                <select
                  value={payrollMonth}
                  onChange={(e: any) => setPayrollMonth(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      شهر {i + 1}
                    </option>
                  ))}
                </select>
                <select
                  value={payrollYear}
                  onChange={(e: any) => setPayrollYear(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs outline-none"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
            </div>

            {payrollLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs animate-pulse">جاري احتساب مفردات المرتب...</div>
            ) : !payrollData ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
                لا توجد بيانات مرتب مسجلة لهذا الشهر.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Net Salary Highlight Card */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-xl space-y-2">
                  <span className="text-xs text-emerald-100 font-medium">المرتب الصافي المستحق للقبض</span>
                  <div className="text-3xl font-extrabold tracking-tight">
                    {payrollData.net_salary.toLocaleString("ar-EG")} <span className="text-sm font-normal">ج.م</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-400/30 flex justify-between text-xs text-emerald-100">
                    <span>أيام الحضور: {payrollData.days_attended} يوم</span>
                    <span>ساعات العمل: {payrollData.total_hours} ساعة</span>
                  </div>
                </div>

                {/* Salary Breakdown List */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
                  <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2">تفاصيل مفردات الراتب</h3>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">المرتب الأساسي</span>
                    <span className="font-bold text-slate-100">{payrollData.basic_salary.toLocaleString()} ج.م</span>
                  </div>

                  {payrollData.meal_allowance > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">بدل الوجبة</span>
                      <span className="font-bold text-emerald-400">+{payrollData.meal_allowance.toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {payrollData.total_bonuses > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">إجمالي المكافآت والزيادات</span>
                      <span className="font-bold text-emerald-400">+{payrollData.total_bonuses.toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {payrollData.total_deductions > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">الخصومات والجزاءات</span>
                      <span className="font-bold text-rose-400">-{payrollData.total_deductions.toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {payrollData.total_advances > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">السلفيات المسحوبة</span>
                      <span className="font-bold text-amber-400">-{payrollData.total_advances.toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {payrollData.insurance > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">مستقطع التأمينات</span>
                      <span className="font-bold text-rose-400">-{payrollData.insurance.toLocaleString()} ج.م</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HR REQUESTS, MEMOS & COMPLAINTS */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Form Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>رفع مذكرة / شكوى / طلب جديد لإدارة HR</span>
              </h3>

              {requestSubmitted ? (
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                  <p className="font-bold text-sm">تم إرسال المذكرة / الطلب بنجاح إلى الإدارة!</p>
                  <p className="text-[11px] text-emerald-200">سيتم مراجعتها من قبل مسئول الموارد البشرية والرد عليها قريباً.</p>
                  <button
                    onClick={() => setRequestSubmitted(false)}
                    className="mt-2 text-[11px] font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                  >
                    رفع مذكرة أو طلب آخر
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">نوع المعاملة</label>
                    <select
                      value={requestType}
                      onChange={(e: any) => setRequestType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none font-semibold text-xs"
                    >
                      <option value="memo">📝 مذكرة عمل / إفادة رسمية</option>
                      <option value="complaint">⚠️ شكوى أو مقترح لإدارة HR</option>
                      <option value="leave">🏖️ طلب إجازة (سنوية / عارضة / مرضية)</option>
                      <option value="advance">💰 طلب سلفة مالية من المرتب</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">الموضوع / العنوان</label>
                    <input
                      type="text"
                      value={requestTitle}
                      onChange={(e: any) => setRequestTitle(e.target.value)}
                      placeholder={
                        requestType === "memo" ? "مثال: مذكرة بخصوص عطل في الجهاز" :
                        requestType === "complaint" ? "مثال: شكوى من تأخر استلام المهام" :
                        requestType === "leave" ? "مثال: طلب إجازة عارضة يومين" : "طلب سلفة طارئة"
                      }
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none"
                      required
                    />
                  </div>

                  {requestType === "advance" && (
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">المبلغ المطلوب (ج.م)</label>
                      <input
                        type="number"
                        value={requestAmount}
                        onChange={(e: any) => setRequestAmount(e.target.value)}
                        placeholder="أدخل قيمة السلفة"
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none font-bold text-emerald-400"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">تفاصيل المذكرة / الشرح والمبررات</label>
                    <textarea
                      value={requestNotes}
                      onChange={(e: any) => setRequestNotes(e.target.value)}
                      rows={3}
                      placeholder="اكتب جميع التفاصيل والأسباب ليتمكن قسم HR من دراستها واتخاذ القرار..."
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">إرفاق صورة / مستند كدليل (اختياري)</label>
                    {requestAttachment ? (
                      <div className="relative w-28 h-28 bg-slate-950 border border-slate-700 rounded-xl overflow-hidden group">
                        <img src={requestAttachment} alt="Attachment" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setRequestAttachment(null)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full shadow-md"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer text-slate-400 hover:text-white transition">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px]">التقط صورة أو اختر مستند من الهاتف</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={requestSubmitting}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {requestSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>إرسال المذكرة / الطلب الآن</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* List Section: Previous Requests & Memos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-200">سجل المذكرات والشكاوى والطلبات المرفوعة</h3>
                <button
                  onClick={fetchMyRequests}
                  className="p-1 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800"
                  title="تحديث القائمة"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
                <button
                  onClick={() => setRequestsFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "all" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setRequestsFilter("memo")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "memo" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  مذكرات عمل
                </button>
                <button
                  onClick={() => setRequestsFilter("complaint")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "complaint" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  شكاوى ومقترحات
                </button>
                <button
                  onClick={() => setRequestsFilter("leave")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "leave" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  إجازات
                </button>
                <button
                  onClick={() => setRequestsFilter("advance")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "advance" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  سلف
                </button>
              </div>

              {myRequestsLoading ? (
                <div className="p-6 text-center text-slate-400 text-xs animate-pulse">جاري تحميل سجل المذكرات والطلبات...</div>
              ) : myRequests.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-xl text-xs">
                  لم تقم برفع أي مذكرات أو شكاوى حتى الآن.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myRequests
                    .filter((r) => requestsFilter === "all" || r.request_type === requestsFilter)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-100">{item.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                item.request_type === "memo" ? "bg-cyan-500/20 text-cyan-300" :
                                item.request_type === "complaint" ? "bg-purple-500/20 text-purple-300" :
                                item.request_type === "advance" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                              }`}>
                                {item.request_type === "memo" ? "مذكرة" :
                                 item.request_type === "complaint" ? "شكوى" :
                                 item.request_type === "advance" ? "سلفة" : "إجازة"}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {formatDisplayDate(item.created_at)} - {formatDisplayTime(item.created_at)}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            item.status === "approved" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            item.status === "rejected" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                            "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}>
                            {item.status === "approved" ? "تم الموافقة" :
                             item.status === "rejected" ? "تم الرفض" : "قيد المراجعة"}
                          </span>
                        </div>

                        {item.amount && Number(item.amount) > 0 ? (
                          <div className="text-[11px] font-bold text-amber-400 bg-amber-500/10 p-1.5 rounded-lg">
                            المبلغ المطلوب: {Number(item.amount).toLocaleString()} ج.م
                          </div>
                        ) : null}

                        {item.notes && (
                          <p className="text-slate-300 text-[11px] bg-slate-900 p-2 rounded-lg leading-relaxed whitespace-pre-wrap">
                            {item.notes}
                          </p>
                        )}

                        {item.attachment && (
                          <div>
                            <button
                              onClick={() => setSelectedPhotoModal(item.attachment!)}
                              className="text-[10px] text-teal-400 font-bold flex items-center gap-1 hover:underline"
                            >
                              📸 عرض المرفق / الصورة المسجلة
                            </button>
                          </div>
                        )}

                        {item.admin_response && (
                          <div className="mt-2 p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-emerald-400 block">💬 رد إدارة HR:</span>
                            <p className="text-[11px] text-emerald-200">{item.admin_response}</p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: MESSAGES & NOTIFICATIONS FROM HR */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-400 animate-bounce" />
                  <span>مركز الرسائل والتنبيهات الإدارية ({notifications.length})</span>
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markNotificationsAsRead}
                    className="text-[10px] font-bold text-purple-300 hover:text-purple-200 bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/30 transition"
                  >
                    تعليم الكل كمقروء ✓
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl space-y-2">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-bold">لا توجد رسائل أو إشعارات حالياً</p>
                  <p className="text-[10px] text-slate-500">
                    أي رسالة أو تنبيه يتم إرساله من إدارة الموارد البشرية سيظهر لك هنا فوراً.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-0.5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-2xl border text-xs transition-all space-y-1.5 ${
                        n.read
                          ? "bg-slate-950/70 border-slate-800 text-slate-300"
                          : "bg-purple-950/40 border-purple-600/50 text-slate-100 shadow-md shadow-purple-950/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0 animate-ping" />
                          )}
                          <span className="font-black text-slate-100 text-xs">{n.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 font-mono">
                          {formatDisplayDate(n.created_at)} {formatDisplayTime(n.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/60 whitespace-pre-wrap">
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* CHECKIN SUCCESS MODAL / TOAST */}
      <AnimatePresence>
        {checkinSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">{checkinSuccess.message}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  تم تسجيل البصمة بالتوقيت: <span className="text-emerald-400 font-bold">{checkinSuccess.time}</span>
                </p>
              </div>

              {checkinSuccess.photo && (
                <img
                  src={checkinSuccess.photo}
                  alt="Proof"
                  className="w-28 h-28 object-cover rounded-2xl mx-auto border-2 border-emerald-500/50 shadow-md"
                />
              )}

              {checkinSuccess.delay_minutes > 0 && (
                <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-xs">
                  تأخير عن الشيفت: {checkinSuccess.delay_minutes} دقيقة (خصم {checkinSuccess.penalty} ج.م)
                </div>
              )}

              <button
                onClick={() => setCheckinSuccess(null)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                تم وموافق
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHOTO PREVIEW MODAL */}
      {selectedPhotoModal && (
        <div
          onClick={() => setSelectedPhotoModal(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative max-w-sm w-full bg-slate-900 p-2 rounded-2xl border border-slate-700">
            <button
              onClick={() => setSelectedPhotoModal(null)}
              className="absolute -top-3 -right-3 p-2 bg-rose-600 text-white rounded-full shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={selectedPhotoModal} alt="Enlarged" className="w-full rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {/* DYNAMIC BRANCH QR ATTENDANCE MODAL */}
      {showQrScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrScanModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-white mb-1">
              مسح رمز QR الفرع للحضور
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              أدخل كود QR المعروض على شاشة الفرع الآن أو امسحه بكاميرا الهاتف
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={qrScanInput}
                onChange={(e) => setQrScanInput(e.target.value)}
                placeholder="أدخل كود QR المعروض على شاشة الفرع..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-center text-sm text-white font-mono placeholder:text-slate-600 focus:border-emerald-500 outline-none"
              />

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => handleQrAttendanceSubmit("check_in")}
                  disabled={qrScanning || !qrScanInput.trim()}
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
                >
                  تسجيل حضور (QR)
                </button>
                <button
                  onClick={() => handleQrAttendanceSubmit("check_out")}
                  disabled={qrScanning || !qrScanInput.trim()}
                  className="py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
                >
                  تسجيل انصراف (QR)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Mobile Navigation Tabs */}
      <nav className={`${isLight ? "bg-white/95 border-slate-200 shadow-lg" : "bg-slate-900/95 border-slate-800"} border-t fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30 backdrop-blur-md grid grid-cols-5 p-1 transition-colors duration-300`}>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition ${
            activeTab === "attendance"
              ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Camera className="w-4 h-4 mb-0.5" />
          <span>البصمة</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition ${
            activeTab === "history"
              ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Clock className="w-4 h-4 mb-0.5" />
          <span>السجل</span>
        </button>

        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition ${
            activeTab === "payroll"
              ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <DollarSign className="w-4 h-4 mb-0.5" />
          <span>المرتب</span>
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition ${
            activeTab === "requests"
              ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Send className="w-4 h-4 mb-0.5" />
          <span>الطلبات</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("messages");
            markNotificationsAsRead();
          }}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition relative ${
            activeTab === "messages"
              ? isLight ? "text-purple-700 bg-purple-50" : "text-purple-400 bg-purple-500/10"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bell className="w-4 h-4 mb-0.5" />
          <span>الرسائل</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};

