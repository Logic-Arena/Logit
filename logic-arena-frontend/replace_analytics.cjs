const fs = require('fs');

let content = fs.readFileSync('src/pages/AnalyticsPage.tsx', 'utf-8');

content = content.replace(/from 'recharts';/, "from 'recharts';\nimport styles from './AnalyticsPage.module.css';");

// Page Wrapper
content = content.replace(/className=\"bg-\[#0D1117\] text-gray-200 p-6 md:p-8 font-sans h-full overflow-y-auto w-full flex justify-center items-start\"/, "className={styles.analyticsPage}");
content = content.replace(/className=\"max-w-6xl w-full space-y-8\"/, "className={styles.container}");

// Header
content = content.replace(/className=\"flex flex-col md:flex-row md:items-center gap-4 border-b border-\[#30363D\] pb-6\"/, "className={styles.header}");
content = content.replace(/className=\"flex-1 w-full text-center md:text-left\"/, "");
content = content.replace(/className=\"text-2xl font-bold text-white tracking-wide\"/, "className={styles.headerTitle}");

// KPI Grid
content = content.replace(/className=\"w-full flex justify-center\"\s*>\s*<div className=\"grid grid-cols-1 lg:grid-cols-12 gap-6 w-full\"/, "className={styles.bentoGridWrapper}>\n          <div className={styles.bentoGrid}");
content = content.replace(/className=\"lg:col-span-7 flex flex-col gap-6 w-full\"/, "className={styles.chartCardArea}");
content = content.replace(/className=\"grid grid-cols-1 sm:grid-cols-3 gap-6 w-full\"/, "className={styles.kpiGrid}");

// KPICard Component
content = content.replace(/className=\"bg-\[#161B22\] border border-\[#30363D\] rounded-xl p-8 shadow-sm flex flex-col justify-between hover:border-\[#8B5CF6\]\/50 transition-colors h-full\"/, "className={styles.kpiCard}");
content = content.replace(/className=\"flex justify-between items-start mb-3\"/, "className={styles.kpiHeader}");
content = content.replace(/className=\"text-\[#8B949E\] text-sm font-medium\"/, "className={styles.kpiLabel}");
content = content.replace(/className=\"text-xl\"/, "className={styles.kpiIcon}");
content = content.replace(/className=\"text-2xl lg:text-3xl font-bold text-gray-100 mb-1\"/, "className={styles.kpiValue}");
content = content.replace(/className=\{\`text-xs font-semibold \$\{data\.trendUp \? 'text-\[#22C55E\]' : 'text-\[#EF4444\]'\}\`\}/g, "className={`\\${styles.kpiTrendWrapper} \\${data.trendUp ? styles.kpiTrendUp : 'text-[#EF4444]'}`}");

// Area Chart Card
content = content.replace(/className=\"bg-\[#161B22\] border border-\[#30363D\] rounded-xl p-8 shadow-sm flex flex-col flex-1 min-h-\[350px\] w-full\"/, "className={styles.chartCard}");
content = content.replace(/className=\"flex items-center gap-2 mb-6\"/g, "className={styles.chartHeader}");
content = content.replace(/className=\"text-lg font-bold text-gray-100\"/g, "className={styles.chartTitle}");
content = content.replace(/className=\"w-full flex-1 min-h-\[250px\]\"/, "className={styles.chartCardFlex}");

// Radar Chart Card
content = content.replace(/className=\"lg:col-span-5 bg-\[#161B22\] border border-\[#30363D\] rounded-xl p-8 shadow-sm flex flex-col min-h-\[350px\] w-full\"/, "className={`\\${styles.chartCard} \\${styles.chartCardRadar}`}");
content = content.replace(/className=\"flex flex-wrap items-center gap-2 mb-6 justify-between\"/, "className={styles.chartHeaderWrap}");
content = content.replace(/className=\"flex gap-4 text-xs font-medium bg-\[#0D1117\] px-3 py-1\.5 rounded-lg border border-\[#30363D\]\"/, "className={styles.legend}");
content = content.replace(/className=\"flex items-center gap-1\.5\"/g, "className={styles.legendItem}");
content = content.replace(/className=\"w-2\.5 h-2\.5 rounded-full bg-\[#8B5CF6\]\"/g, "className={styles.legendIndicatorUser}");
content = content.replace(/나의 지표/g, "<span className={styles.legendTextUser}>나의 지표</span>");
content = content.replace(/className=\"w-2\.5 h-2\.5 rounded-full bg-\[#8B949E\] opacity-60\"/g, "className={styles.legendIndicatorAvg}");
content = content.replace(/전체 평균/g, "<span className={styles.legendTextAvg}>전체 평균</span>");
content = content.replace(/className=\"w-full flex-1\"/, "className={styles.chartCardFlex}");

// Recommendation
content = content.replace(/className=\"py-2\"/, "className={styles.recommendationContainer}");
content = content.replace(/className=\"bg-gradient-to-r from-\[#161B22\] to-\[#1E1B4B\] border border-\[#8B5CF6\]\/30 rounded-xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-\[0_0_15px_rgba\(139,92,246,0\.1\)\]\"/, "className={styles.recommendationCard}");
content = content.replace(/className=\"flex-1\"/, "className={styles.recommendationLeft}");
content = content.replace(/className=\"flex items-center gap-3 mb-2\"/, "className={styles.recommendationHeader}");
content = content.replace(/className=\"bg-\[#8B5CF6\] text-white text-xs font-bold px-2 py-0\.5 rounded shadow-sm flex-shrink-0\"/, "className={styles.recommendationBadge}");
content = content.replace(/className=\"text-lg font-bold text-gray-100\"/, "className={styles.recommendationTitle}");
content = content.replace(/className=\"text-sm text-\[#8B949E\] leading-relaxed\"/, "className={styles.recommendationDesc}");
content = content.replace(/className=\"px-5 py-2\.5 text-sm font-bold w-full md:w-auto text-white bg-\[#8B5CF6\] rounded-lg hover:bg-\[#7b74ff\] transition-all shadow-lg shadow-\[#8B5CF6\]\/20 flex-shrink-0 cursor-pointer\"/, "className={styles.recommendationBtn}");

// Tooltip
content = content.replace(/className=\"bg-\[#161B22\] border border-\[#30363D\] rounded-lg p-3 shadow-xl backdrop-blur-sm bg-opacity-90\"/, "className={`\\${styles.kpiCard} !p-3 bg-opacity-90 backdrop-blur-sm z-50`}");

// Controls
content = content.replace(/className=\"bg-\[#161B22\] border border-\[#30363D\] rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm sticky top-4 z-10 backdrop-blur-md bg-opacity-95\"/, "className={styles.controlBar}");
content = content.replace(/className=\"relative w-full md:w-80\"/, "className={styles.searchContainer}");
content = content.replace(/className=\"w-full bg-\[#0D1117\] border border-\[#30363D\] text-gray-200 text-sm rounded-lg px-4 py-2\.5 focus:outline-none focus:border-\[#8B5CF6\] focus:ring-1 focus:ring-\[#8B5CF6\] transition-all placeholder-\[#8B949E\]\"/, "className={styles.searchInput}");
content = content.replace(/className=\"flex gap-3 w-full md:w-auto\"/, "className={styles.controlsRight}");
content = content.replace(/className=\"relative flex-1 md:w-36\"/g, "className={styles.selectWrapper}");
content = content.replace(/className=\"w-full appearance-none bg-\[#0D1117\] border border-\[#30363D\] text-gray-200 text-sm rounded-lg pl-4 pr-10 py-2\.5 focus:outline-none focus:border-\[#8B5CF6\] focus:ring-1 focus:ring-\[#8B5CF6\] transition-all cursor-pointer\"/g, "className={styles.sortSelect}");

// List
content = content.replace(/className=\"space-y-4 pt-4\"/, "className={styles.reportGrid}");
content = content.replace(/className=\"group flex flex-col md:flex-row items-start md:items-center p-5 bg-\[#161B22\] border border-\[#30363D\] rounded-xl transition-all duration-300 hover:border-\[#8B5CF6\] hover:shadow-\[0_0_15px_rgba\(139,92,246,0\.2\)\] gap-4 w-full\"/g, "className={styles.reportCard}");

fs.writeFileSync('src/pages/AnalyticsPage.tsx', content);

console.log('Analytics replacements done');
