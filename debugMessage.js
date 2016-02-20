var debugLevel = 1; // 0: No debug message, 1: Info debug message
function printDebugMessage(message, level) {
    if (debugLevel !== 0 && level <= debugLevel) {
        console.log(message);
    }
}
