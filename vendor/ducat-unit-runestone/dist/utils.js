export var Instruction;
(function (Instruction) {
    function isNumber(instruction) {
        return typeof instruction === 'number';
    }
    Instruction.isNumber = isNumber;
    function isBuffer(instruction) {
        return typeof instruction !== 'number';
    }
    Instruction.isBuffer = isBuffer;
})(Instruction || (Instruction = {}));
