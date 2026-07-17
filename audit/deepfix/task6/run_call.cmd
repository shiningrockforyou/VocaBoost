@echo off
set NODE_OPTIONS=--use-system-ca
node audit/playwright/lsr_deepfix_callable.mjs flagon_r27
