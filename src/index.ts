/**
 * Cron Parser
 * Parse and explain cron expressions
 *
 * Online tool: https://devtools.at/tools/cron-parser
 *
 * @packageDocumentation
 */

function parseCronExpression(expression: string): ParsedCron | null {
  const parts = expression.trim().split(/\s+/);

  if (parts.length === 5) {
    return {
      minute: parts[0],
      hour: parts[1],
      dayOfMonth: parts[2],
      month: parts[3],
      dayOfWeek: parts[4],
    };
  } else if (parts.length === 6) {
    return {
      second: parts[0],
      minute: parts[1],
      hour: parts[2],
      dayOfMonth: parts[3],
      month: parts[4],
      dayOfWeek: parts[5],
    };
  }

  return null;
}

function validateCronField(value: string, min: number, max: number): { valid: boolean; error?: string } {
  if (value === "*") return { valid: true };

  // Handle step values (*/n)
  if (value.startsWith("*/")) {
    const step = parseInt(value.substring(2), 10);
    if (isNaN(step) || step <= 0) {
      return { valid: false, error: "Invalid step value" };
    }
    return { valid: true };
  }

  // Handle ranges (n-m)
  if (value.includes("-")) {
    const [start, end] = value.split("-").map(v => parseInt(v, 10));
    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      return { valid: false, error: `Range must be ${min}-${max}` };
    }
    return { valid: true };
  }

  // Handle lists (n,m,o)
  if (value.includes(",")) {
    const values = value.split(",").map(v => parseInt(v, 10));
    if (values.some(v => isNaN(v) || v < min || v > max)) {
      return { valid: false, error: `Values must be ${min}-${max}` };
    }
    return { valid: true };
  }

  // Single value
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min || num > max) {
    return { valid: false, error: `Must be ${min}-${max}` };
  }

  return { valid: true };
}

function describeField(value: string, fieldName: string): string {
  if (value === "*") return `every ${fieldName}`;

  if (value.startsWith("*/")) {
    const step = value.substring(2);
    return `every ${step} ${fieldName}${parseInt(step) > 1 ? "s" : ""}`;
  }

  if (value.includes("-")) {
    const [start, end] = value.split("-");
    return `${fieldName}s ${start} through ${end}`;
  }

  if (value.includes(",")) {
    const values = value.split(",");
    return `${fieldName}s ${values.join(", ")}`;
  }

  return `${fieldName} ${value}`;
}

function describeCron(parsed: ParsedCron): string {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Build time part
  let timePart = "";

  if (parsed.second && parsed.second !== "*") {
    timePart = `at ${describeField(parsed.second, "second")}`;
  }

  if (parsed.minute === "*" && parsed.hour === "*") {
    timePart = timePart ? `${timePart}, every minute` : "every minute";
  } else if (parsed.minute !== "*" && parsed.hour === "*") {
    timePart = `at ${describeField(parsed.minute, "minute")} past every hour`;
  } else if (parsed.minute === "*" && parsed.hour !== "*") {
    timePart = `every minute during ${describeField(parsed.hour, "hour")}`;
  } else {
    const hourDesc = parsed.hour.includes(",") || parsed.hour.includes("-") || parsed.hour.includes("/")
      ? describeField(parsed.hour, "hour")
      : `${parsed.hour.padStart(2, "0")}`;
    const minuteDesc = parsed.minute.includes(",") || parsed.minute.includes("-") || parsed.minute.includes("/")
      ? describeField(parsed.minute, "minute")
      : parsed.minute.padStart(2, "0");
    timePart = `at ${hourDesc}:${minuteDesc}`;
  }

  // Build day part
  let dayPart = "";

  if (parsed.dayOfMonth !== "*" && parsed.dayOfWeek !== "*") {
    const domDesc = describeField(parsed.dayOfMonth, "day");
    const dowDesc = parsed.dayOfWeek.split(",").map(d => {
      const dayNum = parseInt(d, 10);
      return isNaN(dayNum) ? d : dayNames[dayNum];
    }).join(", ");
    dayPart = `on ${domDesc} and ${dowDesc}`;
  } else if (parsed.dayOfMonth !== "*") {
    dayPart = `on ${describeField(parsed.dayOfMonth, "day of month")}`;
  } else if (parsed.dayOfWeek !== "*") {
    const dowDesc = parsed.dayOfWeek.split(",").map(d => {
      const dayNum = parseInt(d, 10);
      return isNaN(dayNum) ? d : dayNames[dayNum];
    }).join(", ");
    dayPart = `on ${dowDesc}`;
  }

  // Build month part
  let monthPart = "";
  if (parsed.month !== "*") {
    const monthDesc = parsed.month.split(",").map(m => {
      const monthNum = parseInt(m, 10);
      return isNaN(monthNum) ? m : monthNames[monthNum - 1];
    }).join(", ");
    monthPart = `in ${monthDesc}`;
  }

  // Combine parts
  const description = [timePart, dayPart, monthPart].filter(p => p).join(" ");
  return description.charAt(0).toUpperCase() + description.slice(1);
}

function getNextExecutions(parsed: ParsedCron, count: number = 5): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  let current = new Date(now.getTime());

  // Simplified execution calculation (for demonstration)
  // In production, use a library like 'cron-parser' for accurate results
  for (let i = 0; i < count * 100 && dates.length < count; i++) {
    current = new Date(current.getTime() + 60000); // Add 1 minute

    const minute = current.getMinutes();
    const hour = current.getHours();
    const dayOfMonth = current.getDate();
    const month = current.getMonth() + 1;
    const dayOfWeek = current.getDay();

    if (!matchesField(parsed.minute, minute)) continue;
    if (!matchesField(parsed.hour, hour)) continue;
    if (!matchesField(parsed.dayOfMonth, dayOfMonth)) continue;
    if (!matchesField(parsed.month, month)) continue;
    if (!matchesField(parsed.dayOfWeek, dayOfWeek)) continue;

    dates.push(new Date(current));
  }

  return dates;
}

function matchesField(field: string, value: number): boolean {
  if (field === "*") return true;

  if (field.startsWith("*/")) {
    const step = parseInt(field.substring(2), 10);
    return value % step === 0;
  }

  if (field.includes("-")) {
    const [start, end] = field.split("-").map(v => parseInt(v, 10));
    return value >= start && value <= end;
  }

  if (field.includes(",")) {
    const values = field.split(",").map(v => parseInt(v, 10));
    return values.includes(value);
  }

  return parseInt(field, 10) === value;
}

// Export for convenience
export default { encode, decode };
