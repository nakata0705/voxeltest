/*jshint multistr: true */
var colorPickerCss = '\
@charset "utf-8";\
/*\
Copyright (c) 2010, Yahoo! Inc. All rights reserved.\
Code licensed under the BSD License:\
http://developer.yahoo.com/yui/license.html\
version: 3.1.1\
build: 47\
*/\
html{color:#000;background:#FFF;}body,div,dl,dt,dd,ul,ol,li,h1,h2,h3,h4,h5,h6,pre,code,form,fieldset,legend,input,textarea,p,blockquote,th,td{margin:0;padding:0;}table{border-collapse:collapse;border-spacing:0;}fieldset,img{border:0;}address,caption,cite,code,dfn,em,strong,th,var{font-style:normal;font-weight:normal;}li{list-style:none;}caption,th{text-align:left;}h1,h2,h3,h4,h5,h6{font-size:100%;font-weight:normal;}q:before,q:after{content:\'\';}abbr,acronym{border:0;font-variant:normal;}sup{vertical-align:text-top;}sub{vertical-align:text-bottom;}input,textarea,select{font-family:inherit;font-size:inherit;font-weight:inherit;}input,textarea,select{*font-size:100%;}legend{color:#000;}\
\
/* clearfix */\
\
.fbox {\
	zoom: 100%;\
}\
.fbox:after {\
	content: "";\
	clear: both;\
	height: 0;\
	display: block;\
	visibility: hidden;\
}\
\
/* test */\
canvas {\
	//margin-top:0;\
	margin:0 !important;\
}\
\
/* tools */\
#toolstage {\
	margin:auto;\
	position:absolute;\
	top:0;right:0;bottom:0;left:0;\
	background-color:#ccc;\
	height:100%;\
	padding-right:166p;\
}\
\
#canvas_wrapper {\
	position:relative;\
	height:100%;\
}\
\
#sighting {\
	position:absolute;\
	margin:auto auto;\
	top:0;right:0;bottom:0;left:0;\
	width:5px;height:5px;\
}\
\
#sighting .hor {\
	width:5px;height:1px;\
	position:absolute;top:2px;left:0;\
	background-color:#000000;\
}\
\
#sighting .ver {\
	width:1px;height:5px;\
	position:absolute;top:0px;left:2px;\
	background-color:#000000;\
}\
\
#tools {\
	position:absolute;\
	bottom:10px;\
    margin:0 auto;\
	left:0px;\
    right:0px;\
	height:40px;\
	width:200px;\
	background:transparent;\
}\
\
#tools li.tools_base {\
	display:block;\
	width:36px;\
	height:36px;\
    margin:0;\
    border:2px solid #666666;\
    background-color:#525252;\
	float:left;\
}\
\
#tools li.tools_base:hover {\
    border:2px solid #ffaa00;\
    background-color:#666666;\
}\
\
#tools li.tools_base.selected {\
    border:2px solid #ffaa00;\
}\
\
#tool01>div {\
	background-image:url("/files/images/tools01.png");\
	background-position:0 0;\
}\
\
#tool02>div {\
	background-image:url("/files/images/tools01.png");\
	background-position:-36px 0px;\
}\
\
#tool03>div {\
	background-image:url("/files/images/tools01.png");\
	background-position:-72px 0px;\
}\
\
#tool04>div {\
	background-image:url("/files/images/tools01.png");\
	background-position:-108px 0px;\
}\
\
#tools li div.tools {\
    display:block;\
    margin:0;\
	width:36px;\
	height:36px;\
}\
\
#tools li.tools_base.selected {\
	border-color:#ffaa00;\
}\
\
#cps {\
	position:absolute;\
	margin:0;\
	left:0px;\
	top:162px;\
	height:80px;\
	width:160px;\
	padding: 0 3px 0 3px;\
	background:transparent;\
}\
\
#cps li.tools_cp_base {\
	display:block;\
	width:36px;\
	height:36px;\
	margin:0;\
	border:2px solid #666666;\
	background:url(/files/images/cp_bg.gif) 0 0 repeat;\
	float:left;\
}\
\
#cps li div.tools_cp {\
	display:block;\
	margin:0;\
	width:36px;\
	height:36px;\
	background-color:#ffffff;\
}\
\
#cps li.tools_cp_base.selected {\
	border-color:#ffaa00;\
}\
#panels {\
	width:166px;\
	background-color:#666;\
	position:absolute;\
	right:0;top:0;\
	height:100%;\
}\
';


// Global variable which will be an interface for PlayCanvas
var colorPicker = {};
colorPicker.activeColor = [255, 255, 255, 255];

// playcanvasにどのツールがセレクトされたかを渡すためのグローバル変数
var selectedTool;
colorPicker.selectedTool = null;

// Create style element and append to head element
var style = document.createElement('style');
document.head.appendChild(style);

// Get asset from registry by id
style.innerHTML = colorPickerCss;

// set html elements
// canvas要素をターゲットに使うため取得
var canvas = $('#application-canvas');
// 消しゴムやマジック選択などのツール類定義
var tools = '<ul id="tools" class="fbox"><li class="tools_base" id="tool01" data-toolname="paint"><div class="tools"></div></li><li class="tools_base" id="tool02" data-toolname="addbox"><div class="tools"></div></li><li class="tools_base" id="tool03" data-toolname="erase"><div class="tools"></div></li><li class="tools_base" id="tool04" data-toolname="magickselect"><div class="tools"></div></li></ul>';
// 照準をツール類と一緒にしておく
tools += '<div id="sighting"><div class="hor"></div><div class="ver"></div></div>';
// カラーピッカーの色ボックスを定義
var cps = '<div id="panels"><ul id="cps" class="fbox"><li class="tools_cp_base"><div class="tools_cp"></div></li><li class="tools_cp_base"><div class="tools_cp"></div></li><li class="tools_cp_base"><div class="tools_cp"></div></li><li class="tools_cp_base"><div class="tools_cp"></div></li><li class="tools_cp_base"><div class="tools_cp"></div></li><li class="tools_cp_base"><div class="tools_cp"></div></li><li class="tools_cp_base"><div class="tools_cp"></div></li><li class="tools_cp_base"><div class="tools_cp"></div></li></ul></div>';

// canvasの既存position指定を変更し外側を追従させたいdivでくるむ
canvas.css('position','relative').wrap( '<div id="toolstage" class="fbox"><div id="canvas_wrapper"></div></div>' );

// ツールと照準をDOMに追加
$('#canvas_wrapper').append(tools);
// 右側のツールランにdiv#panelsを追加し、カラーピッカーボックスも追加
$('#toolstage').append(cps);
resetScreenSize();

// ツール類がクリックされたら.selectedを付与してツール名を変数に格納
$('.tools').click(function(e) {
	$('li.tools_base').removeClass('selected');
	$(this).parent().addClass('selected');
	colorPicker.selectedTool = $(this).parent().data('toolname');
	console.log(colorPicker.selectedTool);	
});

// カラーボックスがクリックされたら.selectedをつけてカラーの値を変数に格納
$('.tools_cp').click(function(e) {
	
	$('li.tools_cp_base').removeClass('selected');
	$(this).parent().addClass('selected');
	getMyColor($(this));
});

// カラーピッカーを生成（クリック前から生成するように変更予定）
$('.tools_cp').colorPicker({
	renderCallback: function($elm, toggled) {
		getMyColor($elm);
	}
});

// run after window resize
var timer = false;
$(window).resize(function() {
	if (timer !== false) {
		clearTimeout(timer);
	}
	timer = setTimeout(function() {
		resetScreenSize();
	}, 200);
});



function getMyColor(elm) {
	var myColorCode = elm.css('background-color');
	//console.log(myColorCode);
	var arrColorCode = myColorCode.replace(/rgba\(/g,'').replace(/rgb\(/g,'').replace(/\)/g,'').replace(/ /g,'').split(',');
	console.log(arrColorCode);
	if ( arrColorCode.length < 4 ) { arrColorCode[3] = 255; } else { arrColorCode[3] = Math.round( Number(arrColorCode[3]) * 255 ) ; }
	
	arrColorCode[0] = Number(arrColorCode[0]);
	arrColorCode[1] = Number(arrColorCode[1]);
	arrColorCode[2] = Number(arrColorCode[2]);
	//arrColorCode[3] = Number(arrColorCode[3]);
	
	colorPicker.activeColor = arrColorCode;
	//console.log(colorPicker.activeColor);
}

function resetScreenSize() {
	$('#toolstage').css({
		height: "100%",
		width: $(document).height() / 480 * 640 + 166
	});
	$('#canvas_wrapper').css({
		height: "100%",
		width: $(document).height() / 480 * 640
	});
	console.log($('canvas').width());
}
