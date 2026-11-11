# 参考値と出典の管理（REFERENCES.md）

ガイドライン値・推奨値・機種仕様は、一次資料で確認してから使います。
確認状況は `src/config/references.js` の `status` で管理し、ここに記録を残します。

| status | 意味 |
|---|---|
| verified | 一次資料（原文）で確認済み。出典の版・ページ・表番号を記録する |
| unverified | 二次資料で見たが原文未確認。画面では「参考値（未確認）」と表示する |
| model | 教育用モデルの仮定（ガイドライン値ではない） |

## 確認が必要な項目

| 項目 | 現状 | 確認する一次資料 |
|---|---|---|
| 予測体重の式 | verified（ARDS Network の式） | ARDS Network 低一回換気量プロトコル |
| PEEP／FiO2 表（低 PEEP・高 PEEP） | unverified | ARDS Network プロトコル原文 |
| VV ECMO 中の人工呼吸器設定 | unverified | ELSO Interim Guidelines for Adult Respiratory Failure（2021、ASAIO Journal）の該当表 |
| CESAR・EOLIA の ECMO 群の換気設定 | unverified | 各試験の原著論文（Lancet 2009、N Engl J Med 2018）と補足資料 |
| ECMO 中の目標 SaO2 | unverified | ELSO ガイドライン原文 |
| 再循環率の計算式 | unverified | ECMO の教科書・総説で式を確認 |
| 換気モードの機種別名称 | PB980・Hamilton C6・Evita V800 とも verified | C6・V500 の取扱説明書またはクイックガイド（伊藤先生が用意）。G5・V300 の資料は参考 |

## メモ（2026-11-11、二次資料で見た内容。原文で未確認）

- ECMO 中の設定として、CESAR 試験では PIP 20〜25 cmH2O、PEEP 10〜15 cmH2O、RR 10 /min、FiO2 0.3 の lung rest が用いられたと総説に記載がある。
- EOLIA 試験の ECMO 群では、プラトー圧 24 cmH2O 以下、PEEP 10 cmH2O 以上、FiO2 0.3 などの設定が用いられたと総説に記載がある（総説により「20 以下」と「24 以下」の記載があり、原著で確認が必要）。
- 上記は出典間で値の記載が揃っていないため、原文確認まで画面には使わない。

## 機種資料（2026-11-11 確認）

| 機種 | 資料 | 確認した内容 |
|---|---|---|
| PB980 | Covidien, Puritan Bennett 980 Ventilator Quick Reference Guide（13-VE-0089(2)a〜h、2015）※伊藤先生提供 | 画面構成、モード体系（Mode＋Mandatory／Spontaneous Type）、VC+ の最低圧（PEEP＋3）、BiLevel の PH ≥ PL＋5、PS は PL 基準、TL ロック |
| HAMILTON-G5 | HAMILTON-G5/S1 クイックガイド（627203/01、2024-02-15）※伊藤先生提供 | 画面構成、モード変更の手順、適応モードの圧上限（アラーム上限 − 10）、アラームの色 |
| HAMILTON-G5 | 添付文書（承認番号 22000BZX00389000、2009 年改訂第 2 版、PMDA） | 換気モード名：(S)CMV（A/C）、P-CMV（P-A/C）、SIMV、P-SIMV、SPONT、NIV、APVcmv、APVsimv、ASV、DuoPAP、APRV |
| HAMILTON-C6 | 取扱説明書 ソフトウェア 1.2.x（10197573/00、2022-11-30）※伊藤先生提供 | 基本画面（2.2.2）、操作（2.3）、モード選択（5.5）、リミット圧とアラーム上限の連動（5.5.2）、モード一覧（表 7-2）、APVcmv の圧の上限と最小吸気圧（7.3）、名称規則（14.4.2） |
| Evita V800／V600 | Dräger, Instructions for use Evita V800 / V600 SW 1.n（9055601）※伊藤先生提供 | メイン画面（4.1.2）、操作と色（4.2）、モード一覧（3.6.2）、AutoFlow の対象モード（7.2）、設定範囲（16.2）、Pmax/Paw high autoset（17.7）。2026-11-11 に Evita は V800 風で作ると決定 |
| Evita Infinity V500 | Dräger, Evita Infinity V500 人工呼吸器カタログ（90 68 263、2020）※伊藤先生提供 | 換気モード名、拡張機能、成人の設定範囲、測定値・計算値、画面 6 種類。画面配置の詳細はなし |
| Evita V300 | Dräger, Evita V300 人工呼吸器カタログ（90 67 953、2019）※伊藤先生提供 | 換気モード名、AutoFlow は VC-AC の拡張、測定値・計算値の項目と範囲 |
| PB980 | Puritan Bennett 980 取扱説明書、クイックガイド ※伊藤先生が確認（2026-11-11） | VC+ の目標吸気圧の上限（PEAK アラーム上限 − 3 cmH2O）、最大回路内圧（125 cmH2O 未満）。ページ番号は未記録 |
| Evita V800／V600、V300 | 各取扱説明書の AutoFlow の動作原理 ※伊藤先生が確認（2026-11-11） | AutoFlow の最小吸気圧（トリガなしの強制換気は PEEP + 3、トリガありの強制換気・自発呼吸は PEEP + 0.1）。上限は Pmax による制限。節番号は未記録 |

2026-11-11：PB980 の VC+ の圧の上限と Evita の AutoFlow の最小吸気圧は、ページ・節番号が分かっていない。分かった時点でこの表に追記する。

注意：Hamilton C6 では圧規定モードを PCV+ と表記する資料があり、G5 の P-CMV と名称が異なる。G5 と C6 の名称を混ぜない。

2026-11-11 決定：Hamilton は C6 風、Evita は V500 風で作る。G5・V300 で確認した内容は参考扱いとし、C6・V500 の資料で確認できたものから verified に切り替える。

2026-11-11 決定：Evita は V800 風で作る。V500・V300 のカタログは参考扱い。
