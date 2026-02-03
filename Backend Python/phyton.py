import pandas as pd
import re
import io
import sys
import json

# ==========================================
# 1. CONFIGURATION
# ==========================================
UNDERCUT_AMOUNT = 5  # How much to beat the competitor by (₦)

# ==========================================
# 2. INPUT DATA
# ==========================================

# --- API PROVIDER COST PRICE ---
raw_cost_data = """
Network,ID,Plan Size,Price,Validity_Type
MTN,342,500 MB,350,DATA SHARE (30 DAYS)
MTN,378,500 MB,350,SME (30 DAYS)
MTN,414,500 MB,350,CG (30 DAYS)
MTN,288,500 MB,450,SME 2 (30 DAYS)
MTN,385,750 MB,441,GIFTING (3 DAYS)
MTN,415,1.0 GB,410,SME (7 DAYS)
MTN,416,1.0 GB,410,DATA SHARE (7 DAYS)
MTN,417,1.0 GB,410,GIFT (7 DAYS)
MTN,418,1.0 GB,410,CG (7 DAYS)
MTN,362,1.0 GB,490,AWOOF (1 DAY)
MTN,213,1.0 GB,510,CG (30 DAYS)
MTN,343,1.0 GB,510,DATA SHARE (30 DAYS)
MTN,403,1.0 GB,510,SME (30 DAYS)
MTN,404,1.0 GB,510,GIFT (30 DAYS)
MTN,289,1.0 GB,860,SME 2 (30 DAYS)
MTN,382,1.2 GB,735,XTRA SPECIAL (7 DAYS)
MTN,363,1.5 GB,588,AWOOF (2 DAYS)
MTN,365,2.0 GB,882,AWOOF (2 DAYS)
MTN,214,2.0 GB,950,CG (30 DAYS)
MTN,344,2.0 GB,950,DATA SHARE (30 DAYS)
MTN,402,2.0 GB,950,SME (30 DAYS)
MTN,376,2.0 GB,"1,470",GIFTING (30 DAYS)
MTN,290,2.0 GB,"1,720",SME 2 (30 DAYS)
MTN,386,2.5 GB,735,GIFTING (1 DAY)
MTN,379,2.7 GB,"1,960",GIFTING (30 DAYS)
MTN,44,3.0 GB,"1,400",SME (30 DAYS)
MTN,215,3.0 GB,"1,400",CG (30 DAYS)
MTN,345,3.0 GB,"1,400",DATA SHARE (30 DAYS)
MTN,387,3.0 GB,"1,470",3GB+1500 Talk time (30 DAYS)
MTN,291,3.0 GB,"2,580",SME 2 (30 DAYS)
MTN,340,3.2 GB,980,AWOOF DATA (2 DAYS)
MTN,427,3.5 GB,980,1 DAY VALIDITY
MTN,384,3.5 GB,"2,450",GIFTING (30 DAYS)
MTN,428,4.0 GB,"1,176",2 DAYS VALIDITY
MTN,8,5.0 GB,"1,900",SME (30 DAYS)
MTN,216,5.0 GB,"1,900",CG (30 DAYS)
MTN,346,5.0 GB,"1,900",DATA SHARE (30 DAYS)
MTN,292,5.0 GB,"4,300",SME 2 (30 DAYS)
MTN,429,5.5 GB,"1,470",2 DAYS VALIDITY
MTN,381,6.0 GB,"2,450",GIFTING (7 DAYS)
MTN,223,10.0 GB,"4,410",SME+10min airtime (30 DAYS)
MTN,366,10.0 GB,"4,410",GIFTING (30 DAYS)
MTN,293,10.0 GB,"8,600",SME 2 (30 DAYS)
MTN,341,11.0 GB,"3,430",AWOOF DATA (7 DAYS)
MTN,375,12.5 GB,"5,390",GIFTING (30 DAYS)
MTN,383,14.5 GB,"4,900",XTRA SPECIAL (30 DAYS)
MTN,368,16.5 GB,"6,370",GIFTING (30 DAYS)
MTN,390,20.0 GB,"4,900",SME (7 DAYS)
MTN,426,20.0 GB,"7,350",GIFT (30 DAYS)
MTN,430,34.0 GB,"9,800",30 DAYS VALIDITY
MTN,371,36.0 GB,"10,780",GIFTING (30 DAYS)
MTN,372,75.0 GB,"17,640",GIFTING (30 DAYS)
MTN,373,165.0 GB,"34,300",GIFTING (30 DAYS)
MTN,380,250.0 GB,"53,900",GIFTING (30 DAYS)
MTN,413,800.0 GB,"122,500",GIFTING YEARLY PLAN
GLO,267,200 MB,100,CG (30 DAYS)
GLO,268,500 MB,205,CG (30 DAYS)
GLO,357,750 MB,195,AWOOF GIFT (1 DAY)
GLO,269,1.024 GB,420,CG (30 DAYS)
GLO,358,1.5 GB,291,AWOOF GIFT (1 DAY)
GLO,270,2.0 GB,840,CG (30 DAYS)
GLO,359,2.5 GB,485,AWOOF GIFT (2 DAYS)
GLO,271,3.072 GB,"1,260",CG (30 DAYS)
GLO,273,5.12 GB,"2,150",CG (30 DAYS)
GLO,196,6.15 GB,"1,940",GIFTING (30 DAYS)
GLO,360,9.8 GB,"1,940",AWOOF GIFT (7 DAYS)
GLO,272,10.8 GB,"4,200",CG (30 DAYS)
GLO,198,11.0 GB,"2,910",GIFTING (30 DAYS)
GLO,199,14.5 GB,"3,880",GIFTING (30 DAYS)
GLO,369,18.5 GB,"4,850",GIFTING (30 DAYS)
GLO,202,28.0 GB,"7,760",GIFTING (30 DAYS)
GLO,203,38.0 GB,"9,700",GIFTING (30 DAYS)
GLO,263,107.0 GB,"19,400",GIFTING (30 DAYS)
AIRTEL,391,150 MB,60,AWOOF (1 DAY)
AIRTEL,392,300 MB,98,AWOOF (2 DAYS)
AIRTEL,393,600 MB,196,AWOOF (2 DAYS)
AIRTEL,394,1.0 GB,294,AWOOF (3 DAYS)
AIRTEL,405,1.0 GB,790,GIFT (7 DAYS)
AIRTEL,395,2.0 GB,"1,470",GIFT (30 DAYS)
AIRTEL,421,3.0 GB,"1,960",GIFT (30 DAYS)
AIRTEL,422,4.0 GB,"2,460",GIFT (30 DAYS)
AIRTEL,397,8.0 GB,"2,950",GIFT (30 DAYS)
AIRTEL,398,10.0 GB,"2,940",AWOOF (30 DAYS)
AIRTEL,399,13.0 GB,"4,980",GIFT (30 DAYS)
AIRTEL,423,18.0 GB,"5,870",GIFT (30 DAYS)
AIRTEL,424,25.0 GB,"7,820",GIFT (30 DAYS)
AIRTEL,400,35.0 GB,"9,800",GIFT (30 DAYS)
AIRTEL,401,60.0 GB,"14,900",GIFT (30 DAYS)
AIRTEL,425,100.0 GB,"19,500",GIFT (30 DAYS)
9MOBILE,276,100 MB,50,30 DAYS
9MOBILE,337,500 MB,180,CG (30 DAYS)
9MOBILE,182,500 MB,450,GIFTING (7 Days)
9MOBILE,277,1.0 GB,350,CG (30 DAYS)
9MOBILE,278,1.5 GB,525,CG (30 DAYS)
9MOBILE,183,1.5 GB,850,GIFTING (30 Days)
9MOBILE,279,2.0 GB,700,CG (30 DAYS)
9MOBILE,184,2.0 GB,"1,020",GIFTING (30 Days)
9MOBILE,280,3.0 GB,"1,050",CG (30 DAYS)
9MOBILE,185,3.0 GB,"1,275",GIFTING (30 Days)
9MOBILE,281,4.0 GB,"1,400",CG (30 DAYS)
9MOBILE,283,4.5 GB,"1,575",CG (30 DAYS)
9MOBILE,186,4.5 GB,"1,700",GIFTING (30 Days)
9MOBILE,282,5.0 GB,"1,750",CG (30 DAYS)
9MOBILE,187,11.0 GB,"3,400",GIFTING (30 Days)
9MOBILE,284,11.0 GB,"3,850",CG (30 DAYS)
9MOBILE,188,15.0 GB,"4,250",GIFTING (30 Days)
9MOBILE,338,20.0 GB,"7,000",CG (30 DAYS)
9MOBILE,189,40.0 GB,"8,500",GIFTING (30 Days)
9MOBILE,190,75.0 GB,"12,750",GIFTING (30 Days)
"""

# --- API PROVIDER DEFAULT SELLING ---
raw_default_data = """
Network,Plan Size,Price,Validity_Type
MTN,500 MB,310,DATA SHARE (30 Days)
MTN,500 MB,310,SME (30 Days)
MTN,500 MB,310,CG (30 Days)
MTN,500 MB,425,Gifting (30 Days)
MTN,750 MB,437,Gifting (3 Days)
MTN,1.0 GB,409,CG (30 Days)
MTN,1.0 GB,409,SME (7 Days)
MTN,1.0 GB,409,Gift (7 Days)
MTN,1.0 GB,485,Awoof (1 Day)
MTN,1.0 GB,500,DATA SHARE (30 Days)
MTN,1.0 GB,500,SME (30 Days)
MTN,1.0 GB,500,CG (30 Days)
MTN,1.0 GB,500,Gift (30 Days)
MTN,1.0 GB,850,Gifting (30 Days)
MTN,1.2 GB,728,Xtra Special (7 Days)
MTN,1.5 GB,582,Awoof (2 Days)
MTN,2.0 GB,900,Awoof (2 Days)
MTN,2.0 GB,900,DATA SHARE (30 Days)
MTN,2.0 GB,900,SME (30 Days)
MTN,2.0 GB,"1,455",Gifting (30 Days)
MTN,2.0 GB,"1,700",Standard (30 Days)
MTN,2.5 GB,730,Gifting (1 Day)
MTN,2.5 GB,873,Awoof (2 Days)
MTN,2.7 GB,"1,940",Gifting (30 Days)
MTN,3.0 GB,"1,300",SME (30 Days)
MTN,3.0 GB,"1,300",DATA SHARE (30 Days)
MTN,3.0 GB,"1,300",CG (30 Days)
MTN,3.0 GB,"1,455",3GB + 1500 Talk Time (30 Days)
MTN,3.0 GB,"2,550",Standard (30 Days)
MTN,3.2 GB,970,Awoof (2 Days)
MTN,3.5 GB,970,1 Day Validity
MTN,3.5 GB,"2,425",Gifting (30 Days)
MTN,4.0 GB,"1,164",2 Days Validity
MTN,5.0 GB,"1,800",SME (30 Days)
MTN,5.0 GB,"1,800",DATA SHARE (30 Days)
MTN,5.0 GB,"1,800",CG (30 Days)
MTN,5.0 GB,"4,250",Standard (30 Days)
MTN,5.5 GB,"1,455",2 Days Validity
MTN,6.0 GB,"2,425",Gifting (7 Days)
MTN,10.0 GB,"4,365",Gifting (30 Days)
MTN,10.0 GB,"4,365",SME + 10min Airtime (30 Days)
MTN,10.0 GB,"8,500",Standard (30 Days)
MTN,11.0 GB,"3,395",Awoof (7 Days)
MTN,12.5 GB,"5,335",Gifting (30 Days)
MTN,14.5 GB,"4,850",Xtra Special (30 Days)
MTN,16.5 GB,"6,305",Gifting (30 Days)
MTN,20.0 GB,"4,850",SME (7 Days)
MTN,20.0 GB,"7,275",Gift (30 Days)
MTN,34.0 GB,"9,700",30 Days Validity
MTN,36.0 GB,"10,670",Gifting (30 Days)
MTN,75.0 GB,"17,460",Gifting (30 Days)
MTN,165.0 GB,"33,950",Gifting (30 Days)
MTN,250.0 GB,"53,350",Gifting (30 Days)
MTN,800.0 GB,"121,250",Gifting Yearly Plan
GLO,200 MB,90,CG (30 Days)
GLO,500 MB,198,CG (30 Days)
GLO,750 MB,190,Awoof Gift (1 Day)
GLO,1.024 GB,400,CG (30 Days)
GLO,1.5 GB,285,Awoof Gift (1 Day)
GLO,2.0 GB,800,CG (30 Days)
GLO,2.5 GB,475,Awoof Gift (2 Days)
GLO,3.072 GB,"1,200",CG (30 Days)
GLO,5.12 GB,"2,000",CG (30 Days)
GLO,6.15 GB,"1,880",Gifting (30 Days)
GLO,9.8 GB,"1,880",Awoof Gift (7 Days)
GLO,10.8 GB,"4,000",CG (30 Days)
GLO,11.0 GB,"2,820",Gifting (30 Days)
GLO,14.5 GB,"3,760",Gifting (30 Days)
GLO,18.5 GB,"4,700",Gifting (30 Days)
GLO,28.0 GB,"7,520",Gifting (30 Days)
GLO,38.0 GB,"9,400",Gifting (30 Days)
GLO,107.0 GB,"18,800",Gifting (30 Days)
AIRTEL,150 MB,55,Awoof (1 Day)
AIRTEL,300 MB,98,Awoof (2 Days)
AIRTEL,600 MB,195,Awoof (2 Days)
AIRTEL,1.0 GB,288,Awoof (3 Days)
AIRTEL,1.0 GB,768,Gift (7 Days)
AIRTEL,2.0 GB,"1,440",Gift (30 Days)
AIRTEL,3.0 GB,"1,920",Gift (30 Days)
AIRTEL,4.0 GB,"2,400",Gift (30 Days)
AIRTEL,8.0 GB,"2,880",Gift (30 Days)
AIRTEL,10.0 GB,"2,880",Awoof (30 Days)
AIRTEL,13.0 GB,"4,800",Gift (30 Days)
AIRTEL,18.0 GB,"5,760",Gift (30 Days)
AIRTEL,25.0 GB,"7,680",Gift (30 Days)
AIRTEL,35.0 GB,"9,700",Gift (30 Days)
AIRTEL,60.0 GB,"14,850",Gift (30 Days)
AIRTEL,100.0 GB,"19,200",Gift (30 Days)
9MOBILE,100 MB,50,30 Days
9MOBILE,500 MB,150,30 Days
9MOBILE,500 MB,450,Gifting (7 Days)
9MOBILE,1.0 GB,300,CG (30 Days)
9MOBILE,1.5 GB,450,CG (30 Days)
9MOBILE,1.5 GB,850,Gifting (30 Days)
9MOBILE,2.0 GB,600,CG (30 Days)
9MOBILE,2.0 GB,"1,020",Gifting (30 Days)
9MOBILE,3.0 GB,900,CG (30 Days)
9MOBILE,3.0 GB,"1,275",Gifting (30 Days)
9MOBILE,4.0 GB,"1,200",CG (30 Days)
9MOBILE,4.5 GB,"1,350",CG (30 Days)
9MOBILE,4.5 GB,"1,700",Gifting (30 Days)
9MOBILE,5.0 GB,"1,500",CG (30 Days)
9MOBILE,11.0 GB,"3,300",CG (30 Days)
9MOBILE,11.0 GB,"3,400",Gifting (30 Days)
9MOBILE,15.0 GB,"4,250",Gifting (30 Days)
9MOBILE,20.0 GB,"6,000",Gifting (30 Days)
9MOBILE,40.0 GB,"8,500",Gifting (30 Days)
9MOBILE,75.0 GB,"12,750",Gifting (30 Days)
"""

# --- COMPETITOR 1 (ClubKonnect) ---
raw_comp1_data = """
Network,Plan Name,Price
MTN,110MB Daily Plan - 1 day (Awoof Data),97
MTN,230MB Daily Plan - 1 day (Awoof Data),194
MTN,500 MB - 7 days (SME),404
MTN,500MB Daily Plan - 1 day (Awoof Data),340
MTN,500MB Weekly Plan - 7 days (Direct Data),485
MTN,1 GB - 7 days (SME),567
MTN,1GB Daily Plan + 1.5mins. - 1 day (Awoof Data),485
MTN,1GB Weekly Plan - 7 days (Direct Data),776
MTN,1.5GB Weekly Plan - 7 days (Direct Data),970
MTN,2 GB - 7 days (SME),"1,134"
MTN,2GB+2mins Monthly Plan - 30 days (Direct Data),"1,455"
MTN,2.5GB Daily Plan - 1 day (Awoof Data),728
MTN,2.5GB 2-Day Plan - 2 days (Awoof Data),873
MTN,2.7GB+2mins Monthly Plan - 30 days (Direct Data),"1,940"
MTN,3 GB - 7 days (SME),"1,680"
MTN,3.2GB 2-Day Plan - 2 days (Awoof Data),970
MTN,3.5GB Weekly Plan - 7 days (Direct Data),"1,455"
MTN,3.5GB+5mins Monthly Plan - 30 days (Direct Data),"2,425"
MTN,5 GB - 7 days (SME),"2,540"
MTN,6GB Weekly Plan - 7 days (Direct Data),"2,425"
MTN,7GB Monthly Plan - 30 days (Direct Data),"3,395"
MTN,10GB+10mins Monthly Plan - 30 days (Direct Data),"4,365"
MTN,11GB Weekly Bundle - 7 days (Direct Data),"3,395"
MTN,12.5GB Monthly Plan - 30 days (Direct Data),"5,335"
MTN,16.5GB+10mins Monthly Plan - 30 days (Direct Data),"6,305"
MTN,20GB Monthly Plan - 30 days (Direct Data),"7,275"
MTN,20GB Weekly Plan - 7 days (Direct Data),"4,850"
MTN,25GB Monthly Plan - 30 days (Direct Data),"8,730"
MTN,36GB Monthly Plan - 30 days (Direct Data),"10,670"
MTN,75GB Monthly Plan - 30 days (Direct Data),"17,460"
MTN,150GB 2-Month Plan - 60 days (Direct Data),"38,800"
MTN,165GB Monthly Plan - 30 days (Direct Data),"33,950"
MTN,480GB 3-Month Plan - 90 days (Direct Data),"87,300"
GLO,125MB - 1 day (Awoof Data),95
GLO,200 MB - 14 days (SME),94
GLO,260MB - 2 day (Awoof Data),191
GLO,500 MB - 7 days (SME),235
GLO,875MB - Weekend Plan [Sun] (Awoof Data),191
GLO,1 GB - 3 days (SME),282
GLO,1 GB - 7 days (SME),329
GLO,1 GB - 14 days Night Plan (SME),329
GLO,1 GB - 30 days (SME),470
GLO,1.5GB - 14 days (Direct Data),477
GLO,2 GB - 30 days (SME),940
GLO,2GB - 1 day (Awoof Data),477
GLO,2.5GB - Weekend Plan - [Sat & Sun] (Awoof Data),477
GLO,2.6GB - 30 days (Direct Data),955
GLO,3 GB - 3 days (SME),846
GLO,3 GB - 7 days (SME),987
GLO,3 GB - 14 days Night Plan (SME),987
GLO,3 GB - 30 days (SME),"1,410"
GLO,5 GB - 3 days (SME),"1,410"
GLO,5 GB - 7 days (SME),"1,645"
GLO,5 GB - 14 days Night Plan (SME),"1,645"
GLO,5 GB - 30 days (SME),"2,350"
GLO,5GB - 30 days (Direct Data),"1,432"
GLO,6GB - 7 days (Direct Data),"1,432"
GLO,6.15GB - 30 days (Direct Data),"1,910"
GLO,7.5GB - 30 days (Direct Data),"2,387"
GLO,10 GB - 14 days Night Plan (SME),"3,290"
GLO,10 GB - 30 days (SME),"4,700"
GLO,10GB - 30 days (Direct Data),"2,865"
GLO,12.5GB - 30 days (Direct Data),"3,820"
GLO,16GB - 30 days (Direct Data),"4,775"
GLO,28GB - 30 days (Direct Data),"7,640"
GLO,38GB - 30 days (Direct Data),"9,550"
GLO,64GB - 30 days (Direct Data),"14,325"
GLO,107GB - 30 days (Direct Data),"19,100"
GLO,165GB - 30 days (Direct Data),"28,650"
GLO,220GB - 30 days (Direct Data),"38,200"
GLO,320GB - 30 days (Direct Data),"47,750"
GLO,380GB - 30 days (Direct Data),"57,300"
GLO,475GB - 30 days (Direct Data),"71,625"
GLO,1TB (1000GB) - 365 days (Direct Data),"143,250"
9MOBILE,50 MB - 30 days (SME),23
9MOBILE,100 MB - 30 days (SME),46
9MOBILE,100MB - 1 day (Awoof Data),93
9MOBILE,180MB - 1 days (Awoof Data),140
9MOBILE,250MB - 1 days (Awooof Data),186
9MOBILE,300 MB - 30 days (SME),138
9MOBILE,450MB - 1 day (Awoof Data),326
9MOBILE,500 MB - 30 days (SME),225
9MOBILE,650MB - 3 days (Awoof Data),465
9MOBILE,650MB - 14 days (Direct Data),558
9MOBILE,1 GB - 30 days (SME),450
9MOBILE,1.1GB - 30 days (Direct Data),930
9MOBILE,1.4GB - 30 days (Direct Data),"1,116"
9MOBILE,1.75GB - 7 days (Direct Data),"1,395"
9MOBILE,2 GB - 30 days (SME),900
9MOBILE,2.44GB - 30 days (Direct Data),"1,860"
9MOBILE,3 GB - 30 days (SME),"1,350"
9MOBILE,3.17GB - 30 days (Direct Data),"2,325"
9MOBILE,3.91GB - 30 days (Direct Data),"2,790"
9MOBILE,4 GB - 30 days (SME),"1,800"
9MOBILE,5 GB - 30 days (SME),"2,250"
9MOBILE,5.10GB - 30 days (Direct Data),"3,720"
9MOBILE,6.5GB - 30 days (Direct Data),"4,650"
9MOBILE,10 GB - 30 days (SME),"4,500"
9MOBILE,15 GB - 30 days (SME),"6,750"
9MOBILE,16GB - 30 days (Direct Data),"11,160"
9MOBILE,20 GB - 30 days (SME),"9,000"
9MOBILE,24.3GB - 30 days (Direct Data),"17,205"
9MOBILE,25 GB - 30 days (SME),"11,250"
9MOBILE,26.5GB - 30 days (Direct Data),"18,600"
9MOBILE,39GB - 60 days (Direct Data),"27,900"
9MOBILE,78GB - 90 days (Direct Data),"55,800"
9MOBILE,190GB - 180 days (Direct Data),"139,500"
AIRTEL,500MB - 7 days (Direct Data),485
AIRTEL,1GB - 1 day (Awoof Data),485
AIRTEL,1GB - 7 days (Direct Data),776
AIRTEL,1.5GB - 2 days (Awoof Data),582
AIRTEL,1.5GB - 7 days (Direct Data),970
AIRTEL,2GB - 2 days (Awoof Data),727
AIRTEL,2GB - 30 days (Direct Data),"1,455"
AIRTEL,3GB - 2 days (Awoof Data),970
AIRTEL,3GB - 30 days (Direct Data),"1,940"
AIRTEL,3.5GB - 7 days (Direct Data),"1,455"
AIRTEL,4GB - 30 days (Direct Data),"2,425"
AIRTEL,5GB - 2 days (Awoof Data),"1,455"
AIRTEL,6GB - 7 days (Direct Data),"2,425"
AIRTEL,8GB - 30 days (Direct Data),"2,910"
AIRTEL,10GB - 7 days (Direct Data),"2,910"
AIRTEL,10GB - 30 days (Direct Data),"3,880"
AIRTEL,13GB - 30 days (Direct Data),"4,850"
AIRTEL,18GB - 7 days (Direct Data),"4,850"
AIRTEL,18GB - 30 days (Direct Data),"5,820"
AIRTEL,25GB - 30 days (Direct Data),"7,760"
AIRTEL,35GB - 30 days (Direct Data),"9,700"
AIRTEL,60GB - 30 days (Direct Data),"14,550"
AIRTEL,100GB - 30 days (Direct Data),"19,400"
AIRTEL,160GB - 30 days (Direct Data),"29,100"
AIRTEL,210GB - 30 days (Direct Data),"38,800"
AIRTEL,300GB - 90 days (Direct Data),"48,500"
AIRTEL,350GB - 90 days (Direct Data),"58,200"
"""

# --- COMPETITOR 2 (AimToGet) ---
raw_comp2_data = """
Network,Plan Size,Price,Validity_Desc
GLO,1.0 GB,430,Monthly (CG)
GLO,2.0 GB,860,Monthly (CG)
GLO,3.0 GB,"1,290",Monthly (CG)
GLO,10.0 GB,"1,940",7 Days (Special)
GLO,5.0 GB,"2,150",Monthly (CG)
GLO,10.0 GB,"4,300",Monthly (CG)
GLO,28.0 GB,"7,600",Monthly (incl 2GB nite)
GLO,38.0 GB,"9,500",Monthly (incl 2GB nite)
GLO,64.0 GB,"12,750",Monthly (incl 4GB nite)
GLO,107.0 GB,"19,000",Monthly (incl 2GB nite)
MTN,1.0 GB,249,1 Day (Smart)
MTN,500 MB,339,1 Day / 24 Hours
MTN,2.0 GB,380,7 Days (TikTok Only)
MTN,500 MB,399,7/14 Days (SME Plus)
MTN,1.2 GB,435,Monthly (All Socials)
MTN,750 MB,440,3 Days (+ Free 1hr YT/IG/TT)
MTN,1.0 GB,485,1 Day / 24 Hours (+ 1.5 Mins)
MTN,500 MB,485,Weekly (Special)
MTN,1.0 GB,499,7/14 Days (SME Plus)
MTN,2.5 GB,549,1 Day (Smart)
MTN,1.5 GB,588,2 Days (Special)
MTN,2.5 GB,735,1 Day (Special)
MTN,1.0 GB,784,7 Days (+1GB YT Music + Night)
MTN,2.5 GB,870,2 Days (Special)
MTN,3.2 GB,980,2 Days (Special)
MTN,2.0 GB,997,7/14 Days (SME Plus)
MTN,1.8 GB,"1,455",Monthly (+ 1500 Talktime)
MTN,3.0 GB,"1,494",Monthly (SME Plus)
MTN,5.0 GB,"2,000",Monthly (SME Plus)
MTN,20.0 GB,"5,000",7 Days (Special)
MTN,12.5 GB,"5,390",Monthly (Direct)
MTN,16.5 GB,"6,200",Monthly (+ 10mins Direct)
MTN,20.0 GB,"7,100",Monthly (Special)
MTN,36.0 GB,"10,400",Monthly (Direct)
MTN,75.0 GB,"17,640",Monthly (Direct)
MTN,165.0 GB,"33,250",Monthly (Direct)
MTN,250.0 GB,"53,350",2 Months (Direct)
MTN,800.0 GB,"120,000",Yearly
AIRTEL,75 MB,75,1 Day (SME)
AIRTEL,150 MB,80,1 Day (SME)
AIRTEL,300 MB,125,2 Days (SME)
AIRTEL,600 MB,250,2 Days (SME)
AIRTEL,1.5 GB,415,1 Day (SME)
AIRTEL,500 MB,480,7 Days (Special)
AIRTEL,1.5 GB,480,Weekly (Social Plan)
AIRTEL,3.0 GB,760,2 Days (SME)
AIRTEL,5.0 GB,"1,600",2 Days (SME)
AIRTEL,8.0 GB,"2,880",Monthly (Special)
AIRTEL,10.0 GB,"3,065",Monthly (SME)
AIRTEL,13.0 GB,"4,750",Monthly (Direct)
AIRTEL,25.0 GB,"7,600",Monthly (Direct)
AIRTEL,35.0 GB,"9,200",Monthly (Direct)
AIRTEL,60.0 GB,"14,300",Monthly (Direct)
AIRTEL,100.0 GB,"19,000",Monthly (Special)
9MOBILE,500 MB,250,Monthly (Corporate Gifting)
9MOBILE,1.0 GB,499,Monthly (Corporate Gifting)
9MOBILE,1.5 GB,749,Monthly (Corporate Gifting)
9MOBILE,2.0 GB,998,Monthly (Corporate Gifting)
9MOBILE,3.0 GB,"1,497",Monthly (Corporate Gifting)
9MOBILE,4.5 GB,"1,900",Monthly (Special)
9MOBILE,5.0 GB,"2,495",Monthly (Corporate Gifting)
9MOBILE,11.0 GB,"4,900",Monthly (Special)
9MOBILE,10.0 GB,"4,990",Monthly (Corporate Gifting)
9MOBILE,15.0 GB,"7,485",Monthly (Corporate Gifting)
9MOBILE,40.0 GB,"19,960",Monthly (Corporate Gifting)
"""

# ==========================================
# 3. HELPER FUNCTIONS
# ==========================================

def clean_price(price_str):
    if not isinstance(price_str, str): return float(price_str)
    # Remove quotes, commas, Naira symbol, spaces
    clean = re.sub(r'[",₦\s]', '', price_str)
    try:
        return float(clean)
    except:
        return None

def normalize_size(size_str):
    # Convert all to GB
    size_str = str(size_str).upper()
    size_str = re.sub(r'[^\d\.MGTB]', '', size_str) # Keep digits, dots, M, G, T, B
    
    val_match = re.findall(r"[\d\.]+", size_str)
    if not val_match:
        return 0.0
    val = float(val_match[0])
    
    if 'MB' in size_str:
        return round(val / 1024, 3) # Convert to GB
    elif 'TB' in size_str:
        return round(val * 1024, 3)
    else: # Default/GB
        return round(val, 3)

def normalize_validity(val_str):
    val_str = str(val_str).upper()
    
    if 'MONTH' in val_str or '30 DAY' in val_str:
        return 30
    if 'WEEK' in val_str or '7 DAY' in val_str:
        return 7
    if '1 DAY' in val_str or 'DAILY' in val_str or '24 HOUR' in val_str:
        return 1
    
    # Try to extract number of days if explicit
    days = re.findall(r'(\d+)\s*DAY', val_str)
    if days:
        return int(days[0])
    
    return 30 # Default fallback

def parse_csv_string(csv_str):
    return pd.read_csv(io.StringIO(csv_str.strip()))

# ==========================================
# 4. PROCESSING LOGIC
# ==========================================

# -- A. PARSE COST DATA --
df_cost = parse_csv_string(raw_cost_data)
df_cost['Norm_Size'] = df_cost['Plan Size'].apply(normalize_size)
df_cost['Norm_Valid'] = df_cost['Validity_Type'].apply(normalize_validity)
df_cost['Clean_Price'] = df_cost['Price'].apply(clean_price)

# Group by Network, Size, Validity -> Select Lowest Cost Plan
df_master = df_cost.sort_values('Clean_Price').groupby(['Network', 'Norm_Size', 'Norm_Valid']).first().reset_index()

# -- B. PARSE DEFAULT SELLING --
df_def = parse_csv_string(raw_default_data)
df_def['Norm_Size'] = df_def['Plan Size'].apply(normalize_size)
df_def['Norm_Valid'] = df_def['Validity_Type'].apply(normalize_validity)
df_def['Def_Price'] = df_def['Price'].apply(clean_price)

# Merge Default Price
df_master = pd.merge(df_master, df_def[['Network', 'Norm_Size', 'Norm_Valid', 'Def_Price']], 
                     on=['Network', 'Norm_Size', 'Norm_Valid'], how='left')

# --- FIX: SWAP PRICES IF COST > DEFAULT ---
# This ensures the Lowest Price is ALWAYS treated as Cost, and Higher as Default/Selling
def swap_prices(row):
    p1 = row['Clean_Price'] # Currently loaded as Cost
    p2 = row['Def_Price']   # Currently loaded as Default
    
    # If Default is missing, keep Cost as is
    if pd.isnull(p2): return pd.Series([p1, p2])
    
    # If Cost > Default, SWAP THEM
    if p1 > p2:
        return pd.Series([p2, p1]) # Return [Low, High]
    else:
        return pd.Series([p1, p2]) # Return [Low, High]

# Apply the swap logic
df_master[['Clean_Price', 'Def_Price']] = df_master.apply(swap_prices, axis=1)

# -- C. PARSE COMPETITOR 1 --
df_comp1 = parse_csv_string(raw_comp1_data)
def extract_comp1_details(row):
    text = row['Plan Name']
    # Extract Size (rough regex)
    size_match = re.search(r'([\d\.]+\s*(MB|GB|TB))', text, re.IGNORECASE)
    size = normalize_size(size_match.group(1)) if size_match else 0
    # Extract Validity
    valid = normalize_validity(text)
    return pd.Series([size, valid])

df_comp1[['Norm_Size', 'Norm_Valid']] = df_comp1.apply(extract_comp1_details, axis=1)
df_comp1['Comp1_Price'] = df_comp1['Price'].apply(clean_price)
# Get min price per slot
df_comp1_agg = df_comp1.groupby(['Network', 'Norm_Size', 'Norm_Valid'])['Comp1_Price'].min().reset_index()

# -- D. PARSE COMPETITOR 2 --
df_comp2 = parse_csv_string(raw_comp2_data)
df_comp2['Norm_Size'] = df_comp2['Plan Size'].apply(normalize_size)
df_comp2['Norm_Valid'] = df_comp2['Validity_Desc'].apply(normalize_validity)
df_comp2['Comp2_Price'] = df_comp2['Price'].apply(clean_price)
# Get min price per slot
df_comp2_agg = df_comp2.groupby(['Network', 'Norm_Size', 'Norm_Valid'])['Comp2_Price'].min().reset_index()

# -- E. MERGE COMPETITORS --
df_master = pd.merge(df_master, df_comp1_agg, on=['Network', 'Norm_Size', 'Norm_Valid'], how='left')
df_master = pd.merge(df_master, df_comp2_agg, on=['Network', 'Norm_Size', 'Norm_Valid'], how='left')

# -- F. CALCULATE FINAL PRICE --
def calculate_final(row):
    cost = row['Clean_Price'] # Now guaranteed to be the Lower price
    default = row['Def_Price'] # Now guaranteed to be the Higher price
    c1 = row['Comp1_Price']
    c2 = row['Comp2_Price']
    
    # 1. Determine lowest competitor price
    comps = [p for p in [c1, c2] if pd.notnull(p)]
    
    if not comps:
        # No competitor -> Use Default
        final = default if pd.notnull(default) else cost * 1.2 # Fallback margin if no default
    else:
        min_comp = min(comps)
        # Undercut
        final = min_comp - UNDERCUT_AMOUNT
    
    # 2. Profit Protection
    if final < cost:
        final = cost
        
    # 3. Exclusion Flag (if even at cost we are higher than competitor)
    status = "Active"
    if comps:
        min_comp = min(comps)
        if final > min_comp:
            status = "Excluded (Too High)"
            
    return pd.Series([final, status, min(comps) if comps else None])

df_master[['Final Selling Price', 'Status', 'Lowest Competitor']] = df_master.apply(calculate_final, axis=1)

# ==========================================
# 5. FINAL OUTPUT (CSV & GENERAL JSON)
# ==========================================
output_columns = ['Network', 'ID', 'Plan Size', 'Validity_Type', 'Clean_Price', 'Def_Price', 'Lowest Competitor', 'Final Selling Price', 'Status']

# 1. Sort and Select Columns
df_final = df_master.sort_values(['Network', 'Norm_Valid', 'Clean_Price'])[output_columns]

# 2. Rename Columns 
# (Changed to snake_case for better JSON/API compatibility)
df_final.columns = ['Network', 'Plan_ID', 'Size', 'Type_Validity', 'Cost_Price', 'Default_Price', 'Competitor_Price', 'Final_Price', 'Status']

# 3. Filter Active Plans
df_final = df_final[df_final['Status'] == 'Active']

# --- SAVE AS CSV ---
csv_file = "naija_prices_fixed.csv"
df_final.to_csv(csv_file, index=False)

# --- SAVE AS GENERAL JSON ---
json_file = "naija_prices_fixed.json"
# orient='records' creates a list of dictionaries: [{}, {}, {}]
df_final.to_json(json_file, orient='records', indent=4)

# 5. PRINT SUMMARY TO TERMINAL
print("-" * 30)
print(f"✅ Success!")
print(f"📄 CSV saved to: {csv_file}")
print(f"📄 General JSON saved to: {json_file}")
print("-" * 30)

# Optional: Print first 2 JSON objects to terminal for verification
json_preview = df_final.head(2).to_json(orient='records', indent=4)
print("JSON Preview:")
print(json_preview)

# ==========================================
# 6. EXPORT FOR SUPABASE/FRONTEND
# ==========================================

def map_network_to_id(network_name):
    name = network_name.upper()
    if 'MTN' in name: return 1
    if 'GLO' in name: return 2
    if 'AIRTEL' in name: return 3
    if 'MOBILE' in name: return 4
    if 'SMILE' in name: return 5
    return 0

# ... (Keep everything up to the loop in Section 6)

# Prepare list for JSON/CSV export
db_payload = []

for index, row in df_final.iterrows():
    plan = {
        "network_id": map_network_to_id(row['Network']),
        "plan_id": str(row['Plan_ID']),
        "network_name": row['Network'],
        "plan_type": "ALL", 
        "plan_name": f"{row['Size']}GB - {row['Type_Validity']}",
        "amount": int(row['Final_Price']),
        "cost_price": float(row['Cost_Price']),
        "validity": str(row['Type_Validity'])
    }
    db_payload.append(plan)

# --- NEW: SAVE AS CSV FOR SUPABASE ---
df_db = pd.DataFrame(db_payload)
csv_db_file = "plans_for_supabase.csv"
df_db.to_csv(csv_db_file, index=False)

# Output JSON to file (Keep this as backup)
json_db_file = "plans_for_db.json"
with open(json_db_file, 'w') as f:
    json.dump(db_payload, f, indent=2)

print(f"\n✅ [Done] Supabase CSV generated: '{csv_db_file}'")
print(f"👉 Please upload '{csv_db_file}' to your Supabase table.")