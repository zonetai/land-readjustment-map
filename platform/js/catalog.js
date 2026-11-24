// 公開圖資目錄（全部是政府或開放資料的公開圖磚／WMS，不經過任何私有伺服器）
window.GIS_CATALOG = {
 "layers": [
  {
   "id": "aerial",
   "name": "航照圖 (國土測繪中心)",
   "url": "https://wms.nlsc.gov.tw/wms",
   "layerName": "PHOTO2",
   "type": "wms",
   "category": "imagery"
  },
  {
   "id": "bldg_footprint_taipei",
   "name": "建物套繪地籍圖（臺北市）",
   "url": "https://www.historygis.udd.gov.taipei/arcgis/rest/services/Urban/BldgLicense/MapServer/tile/{z}/{y}/{x}",
   "type": "xyz",
   "category": "cadastral"
  },
  {
   "id": "urban_zoning_taipei",
   "name": "都市計畫使用分區圖（臺北市）",
   "url": "https://www.historygis.udd.gov.taipei/arcgis/rest/services/Urban/UrbanPlan/MapServer/tile/{z}/{y}/{x}",
   "type": "xyz",
   "legendUrl": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMTcwIDQ0OCIgd2lkdGg9IjE3MCIgaGVpZ2h0PSI0NDgiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj48aW1hZ2UgeD0iMiIgeT0iNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBVbEVRVlE0amUzUUlSSUFJQXdEUVVUZWUzMExmQmlHUVZVM2pwNklYQkVCZXhqVG5ibVdCUXQ0b0RNMVdFNTFJdGRnUFJtTVZJUGZmQmhnRXc5OFVRYmxTSEY4VHdBQUFBQkpSVTVFcmtKZ2dnPT0iLz48dGV4dCB4PSIyMiIgeT0iMTciIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMzMzMiPuWVhualreWNgDwvdGV4dD48aW1hZ2UgeD0iMiIgeT0iMjQiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgaHJlZj0iZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFCUUFBQUFVQ0FZQUFBQ05pUjBOQUFBQUNYQklXWE1BQUE3RUFBQU94QUdWS3c0YkFBQUFQVWxFUVZRNGplM1FvUkVBTUF3RFFVVGVlMzBMZkJpR1FWVTNqcDZJWEJFQmV4alRuYm1XQlF0NG9ETTFXRTUxSXRkZ1BSbU1WSVBmZkJoZ0V3OThVUWJsU0hGOFR3QUFBQUJKUlU1RXJrSmdnZz09Ii8+PHRleHQgeD0iMjIiIHk9IjM3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7kvY/lroXljYA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjQ0IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIGhyZWY9ImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFBQlFBQUFBVUNBWUFBQUNOaVIwTkFBQUFDWEJJV1hNQUFBN0VBQUFPeEFHVkt3NGJBQUFBUGtsRVFWUTRqV1BKeTh2N3owQkZ3QUlpOXZYTW80cGhUaVZKRUFPcENWaEdEYVFZc0ZCdUJDb1lOWkJ5d0VJRk0xREFxSUVqSmd5ZFNwS29aaUlBZTVjR3NoOUN3d1lBQUFBQVNVVk9SSzVDWUlJPSIvPjx0ZXh0IHg9IjIyIiB5PSI1NyIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzMzMyI+5YWs5ZyS44CB57ag5ZywPC90ZXh0PjxpbWFnZSB4PSIyIiB5PSI2NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaUp0bkhVOFd3dklPTElRWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCam1IVnhJTlJNQmZhd0hhcDUrUWZRQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iNzciIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMzMzMiPuapn+mXnDwvdGV4dD48aW1hZ2UgeD0iMiIgeT0iODQiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgaHJlZj0iZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFCUUFBQUFVQ0FZQUFBQ05pUjBOQUFBQUNYQklXWE1BQUE3RUFBQU94QUdWS3c0YkFBQUFQa2xFUVZRNGpXUEp5OHY3ejBCRndBSWlyQ1pOcElwaHgvTHlJUVpTRTdDTUdrZ3hZS0hjQ0ZRd2FpRGxnSVVLWnFDQVVRTkhUQmdleTh1bm1va0FmYThIUFhsazhTMEFBQUFBU1VWT1JLNUNZSUk9Ii8+PHRleHQgeD0iMjIiIHk9Ijk3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7lrbjmoKE8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjEwNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaUpscE5vb3BoK2NmeUlBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCam1IOHVqbW9rQWZWa0hQWGtFNS9ZQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMTE3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7luILloLTjgIHlgZzou4rloLQ8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjEyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaUpsb0ZVY1d3L0dQcklBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCam1IMXRITlJNQmZka0hmVFNuS1MwQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMTM3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7liqDmsrnnq5njgIHlu6PloLQ8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjE0NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaUp2bzhvWXBoK1Z0a0lBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCam1iNUdobW9rQWZIOEcyWXRRREkwQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMTU3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7pq5jpgJ/lhazot688L3RleHQ+PGltYWdlIHg9IjIiIHk9IjE2NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBVbEVRVlE0amUzUW9SRUFNQXhDMFFybXpRZ0lGbSt2VnhVTnJ2a0MrUVNvcXIyQzRZNmtDRWJ5Z2Nrd29CMThvamVnSHdKR2E4QnZQaVFaRXc5ODNRY1VsV3Zhc3dBQUFBQkpSVTVFcmtKZ2dnPT0iLz48dGV4dCB4PSIyMiIgeT0iMTc3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7pmqfpgZMu5qmL5qKBLuiuiumbu+aJgC7kuqTpgJo8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjE4NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBVbEVRVlE0amUzUW9SRUFNQXhDMFFwR1JXY2lkbTJ2VnhVZFhQa0MrUVNvcXIyTTRRNUpDeWJwZ2M0UWNCem1SQy9nUEJpTVZzQnZQcFJrRXc5OTZ3ZHVUSlNMOUFBQUFBQkpSVTVFcmtKZ2dnPT0iLz48dGV4dCB4PSIyMiIgeT0iMTk3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7lhaznlKjkuovmpa08L3RleHQ+PGltYWdlIHg9IjIiIHk9IjIwNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaXJCNVBvb3BoeDJUeklBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCZ2VrODJqbW9rQWZMb0c2OFJoWENjQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMjE3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7lt6Xmpa3ljYA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjIyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaUpscE5wSXBoK2NmeUlRWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCam1IOHVubW9rQWZWc0hQaE5Eb2JRQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMjM3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7lqJvmqII8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjI0NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaVVpYWxVTVd3T1hseklBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCak95WnRETlJNQmZXRUhRSFpxMnFNQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMjU3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7nrZblt6U8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjI2NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBVbEVRVlE0amUzUW9SRUFNQXhDMFFybWhWblNoWnZyVlVVSDEzeUJmQUtRUE1zWTdzUU9DeWJxZ2M0d1lEdjBpZHFBL1dBd1NnTis4NkVvbTVoOFV3Ym1EYTk4MkFBQUFBQkpSVTVFcmtKZ2dnPT0iLz48dGV4dCB4PSIyMiIgeT0iMjc3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7loKTpmLI8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjI4NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBVbEVRVlE0amUzUW9SRUFNQXhDMFFybWhWblNoWnZyVlVVSDEzeUJmQUtRUE1zWTd1d0lDMGJwZ2M0d1lEdjBpZHFBL1dBd1NnTis4eUVsbTVoOFVnYm1QZU5Fa3dBQUFBQkpSVTVFcmtKZ2dnPT0iLz48dGV4dCB4PSIyMiIgeT0iMjk3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7msrPmtYE8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjMwNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaWZsVWRwNHBoYkcyV0VBT3BDVmhHRGFRWXNGQnVCQ29ZTlpCeXdFSUZNMURBcUlFakpneloyaXlwWmlJQWVvc0dYOHk1V1VjQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMzE3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7ovrLmpa3ljYA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjMyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaWZsVWRwNHBoYkcyV0VBT3BDVmhHRGFRWXNGQnVCQ29ZTlpCeXdFSUZNMURBcUlFakpneloyaXlwWmlJQWVvc0dYOHk1V1VjQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMzM3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7poqjmma/ljYA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjM0NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaU1pWk9vb3BoTS9MeklBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCak95TStqbW9rQWZQZ0hENytTYis0QUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMzU3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7pgYrmhqnnlKjlnLA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjM2NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaVBDYytvWXBoMi9ObElBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCaHV6NWVobW9rQWZOQUczR3JRWStVQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMzc3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7lj6TouZ/ljYDjgIHkv53lrZjljYA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjM4NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaU1pWmFVY1d3R2ZuSElBWlNFN0NNR2tneFlLSGNDRlF3YWlEbGdJVUtacUNBVVFOSFRCak95RDlHTlJNQmZhZ0haNUVLTDRBQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iMzk3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7kv53orbfljYA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjQwNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBrbEVRVlE0aldQSnk4djd6MEJGd0FJaTl2WE1vNHBoVGlWSkVBT3BDVmhHRGFRWXNGQnVCQ29ZTlpCeXdFSUZNMURBcUlFakpneWRTcEtvWmlJQWU1Y0dzaDlDd3dZQUFBQUFTVVZPUks1Q1lJST0iLz48dGV4dCB4PSIyMiIgeT0iNDE3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7lopPlnLA8L3RleHQ+PGltYWdlIHg9IjIiIHk9IjQyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQ1hCSVdYTUFBQTdFQUFBT3hBR1ZLdzRiQUFBQVBVbEVRVlE0amUzUW9RMEFNQkJDMFFybXZZUkpHTGxOVTNVYVhPOEw1Qk9ncXZZS2hqdVNJaGpKQnliRGdIYndpZDZBZmdnWXJRRy8rWkJrVER4OGFBYnR5ODZMMXdBQUFBQkpSVTVFcmtKZ2dnPT0iLz48dGV4dCB4PSIyMiIgeT0iNDM3IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj7mnKrnt6jlrprlnLA8L3RleHQ+PC9zdmc+",
   "category": "urban_planning"
  },
  {
   "id": "non_urban_zone",
   "name": "非都市計畫區使用分區圖",
   "url": "https://wmts.nlsc.gov.tw/wmts/nURBAN1/default/GoogleMapsCompatible/{z}/{y}/{x}.png",
   "type": "xyz",
   "legendUrl": "https://iiicloud.com.tw/REAA/Content/Image/%E5%9C%96%E4%BE%8B%E8%88%87%E5%9C%96%E8%B3%87%E4%BE%86%E6%BA%90%E6%95%B4%E7%90%86/%E9%9D%9E%E9%83%BD%E5%B8%82%E8%A8%88%E7%95%AB%E5%8D%80%E4%BD%BF%E7%94%A8%E5%88%86%E5%8D%80%E5%9C%96.png",
   "category": "urban_planning"
  },
  {
   "id": "non_urban_type",
   "name": "非都市土地使用地類別圖",
   "url": "https://wmts.nlsc.gov.tw/wmts/nURBAN2/default/GoogleMapsCompatible/{z}/{y}/{x}.png",
   "type": "xyz",
   "category": "urban_planning"
  },
  {
   "id": "soil_liquefaction",
   "name": "土壤液化潛勢",
   "url": "https://wmts.nlsc.gov.tw/wmts/SoilLiquefaction/default/EPSG:3857/{z}/{y}/{x}",
   "type": "xyz",
   "legendUrl": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20130%2088%22%20width%3D%22130%22%20height%3D%2288%22%20font-family%3D%22sans-serif%22%3E%0A%20%20%3Crect%20x%3D%222%22%20y%3D%222%22%20width%3D%2218%22%20height%3D%2218%22%20fill%3D%22rgb(237%2C28%2C36)%22%20stroke%3D%22%23999%22%2F%3E%0A%20%20%3Ctext%20x%3D%2226%22%20y%3D%2216%22%20font-size%3D%2213%22%20fill%3D%22%23333%22%3E%E9%AB%98%E6%BD%9B%E5%8B%A2%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%222%22%20y%3D%2226%22%20width%3D%2218%22%20height%3D%2218%22%20fill%3D%22rgb(255%2C242%2C0)%22%20stroke%3D%22%23999%22%2F%3E%0A%20%20%3Ctext%20x%3D%2226%22%20y%3D%2240%22%20font-size%3D%2213%22%20fill%3D%22%23333%22%3E%E4%B8%AD%E6%BD%9B%E5%8B%A2%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%222%22%20y%3D%2250%22%20width%3D%2218%22%20height%3D%2218%22%20fill%3D%22rgb(0%2C219%2C0)%22%20stroke%3D%22%23999%22%2F%3E%0A%20%20%3Ctext%20x%3D%2226%22%20y%3D%2264%22%20font-size%3D%2213%22%20fill%3D%22%23333%22%3E%E4%BD%8E%E6%BD%9B%E5%8B%A2%3C%2Ftext%3E%0A%3C%2Fsvg%3E",
   "legendInfoUrl": "https://www.liquid.net.tw/cgs/public/story04.html",
   "category": "geology_hazard"
  },
  {
   "id": "tsunami",
   "name": "海嘯潛勢圖",
   "url": "https://wmts.nlsc.gov.tw/wmts/TSUNAMIO/default/EPSG:3857/{z}/{y}/{x}",
   "type": "xyz",
   "legendUrl": "https://iiicloud.com.tw/REAA/Content/Image/%E5%9C%96%E4%BE%8B%E8%88%87%E5%9C%96%E8%B3%87%E4%BE%86%E6%BA%90%E6%95%B4%E7%90%86/%E6%B5%B7%E5%98%AF%E6%BD%9B%E5%8B%A2%E5%9C%96.png",
   "category": "geology_hazard"
  },
  {
   "id": "debris_flow",
   "name": "土石流",
   "url": "https://wmts.nlsc.gov.tw/wmts/MUDSLIDE_PG/default/EPSG:3857/{z}/{y}/{x}",
   "type": "xyz",
   "legendUrl": "https://iiicloud.com.tw/REAA/Content/Image/%E5%9C%96%E4%BE%8B%E8%88%87%E5%9C%96%E8%B3%87%E4%BE%86%E6%BA%90%E6%95%B4%E7%90%86/%E5%9C%9F%E7%9F%B3%E6%B5%81.png",
   "category": "geology_hazard"
  },
  {
   "id": "dip_slope",
   "name": "順向坡",
   "url": "https://landslide.geologycloud.tw/jlwmts/jetlink/Dislope/GoogleMapsCompatible/{z}/{x}/{y}.png",
   "type": "xyz",
   "legendUrl": "https://iiicloud.com.tw/REAA/Content/Image/%E5%9C%96%E4%BE%8B%E8%88%87%E5%9C%96%E8%B3%87%E4%BE%86%E6%BA%90%E6%95%B4%E7%90%86/%E9%A0%86%E5%90%91%E5%9D%A1.png",
   "category": "geology_hazard"
  },
  {
   "id": "cadastral_taipei",
   "name": "地籍圖（臺北市）",
   "url": "https://www.historygis.udd.gov.taipei/arcgis/rest/services/Urban/Land/MapServer/tile/{z}/{y}/{x}",
   "type": "xyz",
   "category": "cadastral"
  },
  {
   "id": "cadastral_public_land",
   "name": "公有土地地籍圖（全國）",
   "url": "https://wmts.nlsc.gov.tw/wmts/LAND_OPENDATA/default/EPSG:3857/{z}/{y}/{x}",
   "type": "xyz",
   "category": "cadastral"
  },
  {
   "id": "land_section",
   "name": "地段外圍圖／段籍圖（全國）",
   "url": "https://wmts.nlsc.gov.tw/wmts/LANDSECT/default/EPSG:3857/{z}/{y}/{x}",
   "type": "xyz",
   "category": "cadastral"
  },
  {
   "id": "topo_dgn_2025_taipei",
   "name": "1/1000 地形圖 114年版（臺北市）",
   "url": "https://www.historygis.udd.gov.taipei/arcgis/rest/services/TOPO/DGN_2025/MapServer/tile/{z}/{y}/{x}",
   "type": "xyz",
   "category": "cadastral"
  },
  {
   "id": "fault",
   "name": "斷層",
   "url": "https://geomap.gsmma.gov.tw/mapguide/mapagent/mapagent.fcgi",
   "layerName": "WMS/25K_Geomap_fault_2021",
   "type": "wms",
   "wmsSrs": "EPSG:4326",
   "wmsSingleImage": true,
   "legendUrl": "https://iiicloud.com.tw/REAA/Content/Image/%E5%9C%96%E4%BE%8B%E8%88%87%E5%9C%96%E8%B3%87%E4%BE%86%E6%BA%90%E6%95%B4%E7%90%86/%E6%96%B7%E5%B1%A4.png",
   "category": "geology_hazard"
  },
  {
   "id": "flood",
   "name": "淹水潛勢",
   "url": "https://maps.wra.gov.tw/arcgis/services/WMS/GIC_WMS/MapServer/WMSServer",
   "layerName": "flood_650mm_24hr",
   "type": "wms",
   "legendUrl": "https://iiicloud.com.tw/REAA/Content/Image/%E5%9C%96%E4%BE%8B%E8%88%87%E5%9C%96%E8%B3%87%E4%BE%86%E6%BA%90%E6%95%B4%E7%90%86/%E6%B7%B9%E6%B0%B4%E6%BD%9B%E5%8B%A2.png",
   "category": "geology_hazard"
  },
  {
   "id": "terrain_shaded",
   "name": "地形暈渲圖（高程分層設色）",
   "url": "https://wmts.nlsc.gov.tw/wmts/MOI_SHADERMAP/default/GoogleMapsCompatible/{z}/{y}/{x}",
   "type": "xyz",
   "category": "terrain"
  },
  {
   "id": "terrain_hillshade",
   "name": "地形陰影圖",
   "url": "https://wmts.nlsc.gov.tw/wmts/MOI_HILLSHADE/default/GoogleMapsCompatible/{z}/{y}/{x}",
   "type": "xyz",
   "category": "terrain"
  },
  {
   "id": "contour",
   "name": "等高線圖（2010–2015）",
   "url": "https://wmts.nlsc.gov.tw/wmts/MOI_CONTOUR_2/default/GoogleMapsCompatible/{z}/{y}/{x}",
   "type": "xyz",
   "category": "terrain"
  },
  {
   "id": "slope",
   "name": "坡度圖（2010–2015，七級）",
   "url": "https://wmts.nlsc.gov.tw/wmts/MOI_SLOPEP_LV7_2/default/GoogleMapsCompatible/{z}/{y}/{x}",
   "type": "xyz",
   "legendUrl": "https://iiicloud.com.tw/REAA/Content/Image/%E5%9C%96%E4%BE%8B%E8%88%87%E5%9C%96%E8%B3%87%E4%BE%86%E6%BA%90%E6%95%B4%E7%90%86/%E5%9D%A1%E5%BA%A6%E5%9C%96.png",
   "category": "terrain"
  },
  {
   "id": "aspect",
   "name": "坡向圖",
   "url": "https://wmts.nlsc.gov.tw/wmts/MOI_ASPECT/default/GoogleMapsCompatible/{z}/{y}/{x}",
   "type": "xyz",
   "category": "terrain"
  }
 ],
 "categoryLabels": {
  "imagery": "影像圖資",
  "cadastral": "地籍與地形",
  "urban_planning": "都市計畫與使用分區",
  "geology_hazard": "地質與防災",
  "terrain": "地形與高程",
  "other": "其他圖資"
 },
 "categoryOrder": [
  "cadastral",
  "urban_planning",
  "terrain",
  "imagery",
  "geology_hazard",
  "other"
 ],
 "basemaps": [
  {
   "id": "vector",
   "name": "向量地圖（預設）",
   "desc": "放大縮小字都清楚、有門牌號碼（OpenStreetMap 資料，OpenFreeMap 提供）",
   "url": "",
   "vector": true,
   "attribution": "&copy; OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap contributors",
   "maxZoom": 20
  },
  {
   "id": "taiwan_emap",
   "name": "臺灣通用電子地圖 (e-Map)",
   "desc": "國土測繪中心官方道路與地標",
   "url": "https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}.png",
   "attribution": "&copy; 內政部國土測繪中心",
   "maxZoom": 20
  },
  {
   "id": "osm",
   "name": "OpenStreetMap",
   "desc": "開源標準街道地圖",
   "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
   "attribution": "&copy; OpenStreetMap contributors",
   "maxZoom": 19
  },
  {
   "id": "voyager",
   "name": "一般地圖 (Voyager)",
   "desc": "現代清晰通用街道地圖",
   "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
   "attribution": "Tiles &copy; Esri and contributors",
   "maxZoom": 19
  },
  {
   "id": "satellite",
   "name": "衛星影像 (Satellite)",
   "desc": "Esri 全球影像服務",
   "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
   "attribution": "Tiles &copy; Esri and contributors",
   "maxZoom": 19
  },
  {
   "id": "dark",
   "name": "極簡暗黑 (Dark Matter)",
   "desc": "高對比深色背景，適合圖層疊加",
   "url": "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
   "attribution": "Tiles &copy; Esri",
   "maxZoom": 16
  },
  {
   "id": "positron",
   "name": "極簡白灰 (Positron)",
   "desc": "純淨灰白底圖，突顯地籍色塊",
   "url": "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
   "attribution": "Tiles &copy; Esri",
   "maxZoom": 16
  },
  {
   "id": "topo",
   "name": "地形等高線 (OpenTopo)",
   "desc": "山坡地勢與等高線分析",
   "url": "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
   "attribution": "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap",
   "maxZoom": 17
  }
 ]
};
