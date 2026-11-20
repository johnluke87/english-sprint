<?php
// English Sprint: la pagina dell'app (index.html di React). Pubblica e gratuita, senza login:
// chi ha l'account del portale /apps/ sincronizza in più i progressi sul server (api/?r=session).
header("Content-Type: text/html; charset=utf-8");
header("Cache-Control: no-cache");
readfile(__DIR__ . "/index.html");
