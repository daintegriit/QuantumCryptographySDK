import { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function EncryptionTimeChart() {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    // Temporary static data (safe)
    const performanceData = [120, 132, 101, 134, 90];

    chart.setOption({
      title: {
        text: "Encryption Time Over Last 5 Runs",
        left: "center",
        textStyle: {
          fontSize: 16,
        },
      },
      tooltip: {
        trigger: "axis",
      },
      xAxis: {
        type: "category",
        data: ["Run 1", "Run 2", "Run 3", "Run 4", "Run 5"],
      },
      yAxis: {
        type: "value",
        name: "Time",
        axisLabel: {
          formatter: "{value} ms",
        },
      },
      series: [
        {
          data: performanceData,
          type: "line",
          smooth: true,
          symbol: "circle",
        },
      ],
    });

    return () => {
      chart.dispose();
    };
  }, []);

  return (
    <div
      ref={chartRef}
      style={{
        width: "100%",
        height: "300px",
      }}
    />
  );
}